const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Connexion à la base SQLite
const db = new sqlite3.Database('./sante.db', (err) => {
  if (err) {
    console.error('❌ Erreur connexion SQLite:', err.message);
  } else {
    console.log('✅ Base de données SQLite connectée (sante.db)');
  }
});

// Initialisation du schéma de la table rdv
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS rdv (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient TEXT NOT NULL,
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
});

// ==========================================
// ROUTES API
// ==========================================

// 1. OBTENIR TOUS LES RDV
app.get('/api/rdv', (req, res) => {
  const { medecin, date } = req.query;
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

  sql += ' ORDER BY date_rdv ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur', details: err.message });

    const parsedRows = rows.map(row => ({
      ...row,
      nom: row.patient,
      consultation_data: row.consultation_data ? JSON.parse(row.consultation_data) : null
    }));

    res.json(parsedRows);
  });
});

// 2. CRÉER UNE DEMANDE DE RDV (Patient)
app.post('/api/rdv', (req, res) => {
  const { nom, patient, age, genre, medecin, motif, type, date, date_rdv } = req.body;

  const patientName = (nom || patient || '').trim();
  const doctorName = (medecin || '').trim();
  const appointmentDate = date || date_rdv;

  if (!patientName || !doctorName || !appointmentDate) {
    return res.status(400).json({ error: 'Champs nom, médecin et date requis.' });
  }

  // Vérification de la disponibilité du créneau
  const checkSql = 'SELECT id FROM rdv WHERE medecin = ? AND date_rdv = ? AND status != "REFUSE"';
  db.get(checkSql, [doctorName, appointmentDate], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur lors de la vérification du créneau' });

    if (row) {
      return res.status(409).json({ error: 'Ce créneau horaire est déjà réservé pour ce médecin.' });
    }

    const insertSql = `
      INSERT INTO rdv (patient, age, genre, medecin, motif, type_consultation, date_rdv, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE')
    `;
    const params = [
      patientName, 
      age || null, 
      genre || 'M', 
      doctorName, 
      motif || 'Consultation Générale', 
      type || 'Présentiel', 
      appointmentDate
    ];

    db.run(insertSql, params, function (err) {
      if (err) return res.status(500).json({ error: 'Erreur lors de la création', details: err.message });
      res.status(201).json({
        id: this.lastID,
        patient: patientName,
        medecin: doctorName,
        date_rdv: appointmentDate,
        status: 'EN_ATTENTE'
      });
    });
  });
});

// 3. CHANGER LE STATUT DU RDV (Médecin: CONFIRME / REFUSE)
app.patch('/api/rdv/:id/statut', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['CONFIRME', 'REFUSE'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  db.run('UPDATE rdv SET status = ? WHERE id = ?', [status, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: Number(id), status });
  });
});

// 4. CLÔTURER LA CONSULTATION ET SAUVEGARDER LE BILAN MÉDICAL (Médecin)
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

// 5. SUPPRIMER UN RDV
app.delete('/api/rdv/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM rdv WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Rendez-vous supprimé', id: Number(id) });
  });
});

// Lancement du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur actif sur le port ${PORT}`);
});