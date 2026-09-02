require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuration de Nodemailer pour l'envoi d'emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Fonction utilitaire pour envoyer un email sans bloquer l'API
const sendEmailNotification = (to, subject, text) => {
  if (!to || !process.env.EMAIL_USER) return;
  
  const mailOptions = {
    from: `"MedSUITE Notification" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error('❌ Erreur envoi email:', err.message);
    else console.log('📧 Email envoyé à:', to);
  });
};

// Fonction de génération de mot de passe temporaire aléatoire (ex: "A8X9K2")
const generatePassword = () => {
  return Math.random().toString(36).slice(-6).toUpperCase();
};

// Connexion à la base SQLite
const db = new sqlite3.Database('./sante.db', (err) => {
  if (err) {
    console.error('❌ Erreur connexion SQLite:', err.message);
  } else {
    console.log('✅ Base de données SQLite connectée (sante.db)');
  }
});

// Initialisation des tables SQLite
db.serialize(() => {
  // Table Rendez-vous (avec email_patient et password pour le patient)
  db.run(`
    CREATE TABLE IF NOT EXISTS rdv (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient TEXT NOT NULL,
      email_patient TEXT,
      password TEXT,
      age INTEGER,
      genre TEXT DEFAULT 'M',
      medecin TEXT NOT NULL,
      motif TEXT,
      type_consultation TEXT DEFAULT 'Présentiel',
      date_rdv TEXT NOT NULL,
      status TEXT CHECK(status IN ('EN_ATTENTE', 'CONFIRME', 'REFUSE', 'TERMINE')) DEFAULT 'EN_ATTENTE',
      consultation_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrations douces pour compatibilité avec les bases existantes
  db.run(`ALTER TABLE rdv ADD COLUMN email_patient TEXT`, () => {});
  db.run(`ALTER TABLE rdv ADD COLUMN password TEXT`, () => {});

  // Table Médecins / Utilisateurs
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE NOT NULL,
      email TEXT,
      specialite TEXT DEFAULT 'Généraliste',
      password TEXT NOT NULL
    )
  `);

  db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});

  // Insertion de médecins par défaut si la table est vide
  db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare('INSERT INTO users (nom, email, specialite, password) VALUES (?, ?, ?, ?)');
      stmt.run('Dr. Rakoto', 'rakoto@example.com', 'Généraliste', '1234');
      stmt.run('Dr. Rasoa', 'rasoa@example.com', 'Cardiologue', '1234');
      stmt.finalize();
    }
  });
});

// Helper pour parser en toute sécurité le champ consultation_data (JSON)
const safeParseJSON = (jsonString) => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("❌ Erreur de parsing JSON consultation_data:", e.message);
    return null;
  }
};

// ==========================================
// ROUTES API - AUTHENTIFICATION ET MEDECINS
// ==========================================

// Obtenir la liste des médecins
app.get('/api/medecins', (req, res) => {
  db.all('SELECT id, nom, email, specialite FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Connexion Médecin
app.post('/api/login-medecin', (req, res) => {
  const { nom, password } = req.body;
  db.get('SELECT * FROM users WHERE nom = ? AND password = ?', [nom, password], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Nom ou mot de passe incorrect.' });
    res.json({ id: user.id, nom: user.nom, email: user.email, specialite: user.specialite });
  });
});

// Inscription Nouveau Médecin
app.post('/api/register-medecin', (req, res) => {
  const { nom, email, specialite, password } = req.body;
  if (!nom || !password) return res.status(400).json({ error: 'Nom et mot de passe requis.' });

  const sql = 'INSERT INTO users (nom, email, specialite, password) VALUES (?, ?, ?, ?)';
  db.run(sql, [nom, (email || '').toLowerCase().trim(), specialite || 'Généraliste', password], function (err) {
    if (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Ce nom de médecin existe déjà.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, nom, email, specialite });
  });
});

// Connexion Patient (Accès confidentiel à ses rendez-vous)
app.post('/api/login-patient', (req, res) => {
  const { email_patient, password } = req.body;
  
  if (!email_patient || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email_patient.trim().toLowerCase();
  const cleanPass = password.trim();

  const sql = 'SELECT * FROM rdv WHERE LOWER(email_patient) = ? AND password = ? ORDER BY date_rdv DESC';
  db.all(sql, [cleanEmail, cleanPass], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur', details: err.message });
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe confidentiel incorrect.' });
    }

    const parsedRows = rows.map(row => ({
      ...row,
      nom: row.patient,
      consultation_data: safeParseJSON(row.consultation_data)
    }));

    res.json({ patient: rows[0].patient, email_patient: cleanEmail, rdvs: parsedRows });
  });
});

// ==========================================
// ROUTES API - RENDEZ-VOUS
// ==========================================

// 1. OBTENIR LES RDV (Filtrage possible)
app.get('/api/rdv', (req, res) => {
  const { medecin, date, email_patient } = req.query;
  let sql = 'SELECT * FROM rdv WHERE 1=1';
  const params = [];

  if (medecin) {
    sql += ' AND medecin LIKE ?';
    params.push(`%${medecin}%`);
  }
  if (date) {
    sql += ' AND date_rdv LIKE ?';
    params.push(`${date}%`);
  }
  if (email_patient) {
    sql += ' AND LOWER(email_patient) = ?';
    params.push(email_patient.trim().toLowerCase());
  }

  sql += ' ORDER BY date_rdv ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur', details: err.message });

    const parsedRows = rows.map(row => ({
      ...row,
      nom: row.patient,
      consultation_data: safeParseJSON(row.consultation_data)
    }));

    res.json(parsedRows);
  });
});

// 2. CRÉER UNE DEMANDE DE RDV (avec mot de passe confidentiel)
app.post('/api/rdv', (req, res) => {
  const { nom, patient, email, email_patient, age, genre, medecin, motif, type, date, date_rdv, password, mot_de_passe } = req.body;

  const patientName = String(nom || patient || '').trim();
  const patientEmail = String(email || email_patient || '').trim().toLowerCase();
  const doctorName = String(medecin || '').trim();
  const appointmentDate = date || date_rdv;
  
  // Utilise le mot de passe fourni ou en génère un automatiquement
  const patientPassword = String(password || mot_de_passe || generatePassword()).trim();

  if (!patientName || !doctorName || !appointmentDate) {
    return res.status(400).json({ error: 'Champs nom, médecin et date requis.' });
  }

  // Conversion propre de l'âge
  const ageParsed = age ? parseInt(age, 10) : null;

  const checkSql = 'SELECT id FROM rdv WHERE medecin = ? AND date_rdv = ? AND status != "REFUSE"';
  db.get(checkSql, [doctorName, appointmentDate], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur lors de la vérification du créneau', details: err.message });

    if (row) {
      return res.status(409).json({ error: 'Ce créneau horaire est déjà réservé pour ce médecin.' });
    }

    const insertSql = `
      INSERT INTO rdv (patient, email_patient, password, age, genre, medecin, motif, type_consultation, date_rdv, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE')
    `;
    const params = [
      patientName,
      patientEmail,
      patientPassword,
      isNaN(ageParsed) ? null : ageParsed,
      genre || 'M', 
      doctorName, 
      motif || 'Consultation Générale', 
      type || 'Présentiel', 
      appointmentDate
    ];

    db.run(insertSql, params, function (err) {
      if (err) {
        console.error("❌ Erreur SQL d'insertion RDV:", err.message);
        return res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
      }

      const rdvId = this.lastID;

      // Email de confirmation au patient avec son mot de passe confidentiel
      if (patientEmail) {
        sendEmailNotification(
          patientEmail,
          'Demande de rendez-vous enregistrée - MedSUITE',
          `Bonjour ${patientName},\n\nVotre demande de rendez-vous avec ${doctorName} le ${appointmentDate} a été bien reçue.\n\n🔒 CODE ACCÈS CONFIDENTIEL : ${patientPassword}\nConservez ce mot de passe pour suivre l'état de votre rendez-vous et consulter vos résultats.\n\nCordialement,\nL'équipe MedSUITE.`
        );
      }

      // Notification Email au Médecin
      const docCleanName = doctorName.split('(')[0].trim();
      db.get('SELECT email FROM users WHERE nom LIKE ? OR ? LIKE "%" || nom || "%"', [`%${docCleanName}%`, doctorName], (e, doc) => {
        if (doc && doc.email) {
          sendEmailNotification(
            doc.email,
            'Nouvelle demande de rendez-vous - MedSUITE',
            `Bonjour ${doctorName},\n\nLe patient ${patientName} a demandé un rendez-vous le ${appointmentDate}.\nMotif: "${motif || 'Consultation Générale'}".\n\nConnectez-vous à MedSUITE pour confirmer ou refuser.`
          );
        }
      });

      res.status(201).json({
        id: rdvId,
        patient: patientName,
        email_patient: patientEmail,
        password: patientPassword,
        medecin: doctorName,
        date_rdv: appointmentDate,
        status: 'EN_ATTENTE'
      });
    });
  });
});

// 3. MODIFIER LES INFOS D'UN RDV
app.patch('/api/rdv/:id/infos', (req, res) => {
  const { id } = req.params;
  const { nom, patient, email, email_patient, age, genre, medecin, motif, type, date, date_rdv } = req.body;

  const patientName = String(nom || patient || '').trim();
  const patientEmail = String(email || email_patient || '').trim().toLowerCase();
  const doctorName = String(medecin || '').trim();
  const appointmentDate = date || date_rdv;
  const ageParsed = age ? parseInt(age, 10) : null;

  if (!patientName || !doctorName || !appointmentDate) {
    return res.status(400).json({ error: 'Champs nom, médecin et date requis.' });
  }

  const sql = `
    UPDATE rdv 
    SET patient = ?, email_patient = ?, age = ?, genre = ?, medecin = ?, motif = ?, type_consultation = ?, date_rdv = ?
    WHERE id = ?
  `;

  const params = [
    patientName,
    patientEmail,
    isNaN(ageParsed) ? null : ageParsed,
    genre || 'M',
    doctorName,
    motif || 'Consultation Générale',
    type || 'Présentiel',
    appointmentDate,
    id
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: 'Erreur lors de la modification', details: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Rendez-vous introuvable.' });

    res.json({ message: 'Rendez-vous mis à jour avec succès.', id: Number(id) });
  });
});

// 4. CHANGER LE STATUT DU RDV
app.patch('/api/rdv/:id/statut', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['CONFIRME', 'REFUSE'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  db.get('SELECT * FROM rdv WHERE id = ?', [id], (err, rdv) => {
    if (err || !rdv) return res.status(404).json({ error: 'Rendez-vous introuvable.' });

    db.run('UPDATE rdv SET status = ? WHERE id = ?', [status, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Notification Email au Patient
      if (rdv.email_patient) {
        const action = status === 'CONFIRME' ? 'a CONFIRMÉ' : 'a REFUSÉ';
        sendEmailNotification(
          rdv.email_patient,
          `Mise à jour de votre rendez-vous - MedSUITE`,
          `Bonjour ${rdv.patient},\n\nLe médecin ${rdv.medecin} ${action} votre demande de rendez-vous pour le ${rdv.date_rdv}.\n\nCordialement,\nL'équipe MedSUITE.`
        );
      }

      res.json({ id: Number(id), status });
    });
  });
});

// 5. CLÔTURER LA CONSULTATION
app.put('/api/rdv/:id', (req, res) => {
  const { id } = req.params;
  const { consultation_data } = req.body;

  const consultationJson = JSON.stringify(consultation_data);

  const sql = `
    UPDATE rdv 
    SET status = 'TERMINE', consultation_data = ?
    WHERE id = ?
  `;

  db.run(sql, [consultationJson, id], function (err) {
    if (err) return res.status(500).json({ error: 'Erreur de sauvegarde', details: err.message });
    res.json({ id: Number(id), status: 'TERMINE', consultation_data });
  });
});

// 6. SUPPRIMER UN RDV
app.delete('/api/rdv/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM rdv WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Rendez-vous supprimé', id: Number(id) });
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur actif avec notifications email et gestion confidentielle sur le port ${PORT}`);
  });
}