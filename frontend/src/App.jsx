import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Stethoscope, User, Calendar, ShieldCheck, Plus, X, 
  Activity, FileText, HeartPulse, Trash2, Eye, Printer, Edit, LogOut, UserPlus, Key
} from 'lucide-react';
import './App.css';
const API_BASE = 'https://projet-glog-backend1.onrender.com/api';
//const API_BASE = 'http://localhost:5000/api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const [rdvs, setRdvs] = useState([]);
  const [medecinsList, setMedecinsList] = useState([]);

  const [selectedRdv, setSelectedRdv] = useState(null);
  const [viewDetailsRdv, setViewDetailsRdv] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRdvId, setEditingRdvId] = useState(null);

  // --- ÉTATS D'AUTHENTIFICATION ---
  const [loginRole, setLoginRole] = useState('patient'); // 'patient' ou 'medecin'
  const [isRegistering, setIsRegistering] = useState(false); // Mode Inscription vs Connexion

  const [loginForm, setLoginForm] = useState({ nom: '', email: '', password: '', specialite: 'Généraliste' });

  const [patientForm, setPatientForm] = useState({
    nom: '', email: '', age: '', genre: 'M', medecin: '', 
    date: '', motif: 'Consultation Générale', type: 'Présentiel', password: ''
  });

  const [consultation, setConsultation] = useState({
    tension: '', pouls: '', temp: '', poids: '', diagnostic: '', notes: ''
  });
  const [prescriptions, setPrescriptions] = useState([{ medicament: '', posologie: '', duree: '' }]);

  // Chargement des rendez-vous
  const fetchRdvs = async (user = currentUser) => {
    try {
      if (!user) return;
      
      let url = `${API_BASE}/rdv`;
      if (user.role === 'medecin') {
        url += `?medecin=${encodeURIComponent(user.name)}`;
      } else if (user.role === 'patient') {
        url += `?email_patient=${encodeURIComponent(user.email)}`;
      }

      const response = await axios.get(url);
      setRdvs(response.data);
    } catch (err) {
      console.error("Erreur chargement RDV:", err);
    }
  };

  // Chargement de la liste des médecins
  const fetchMedecins = async () => {
    try {
      const response = await axios.get(`${API_BASE}/medecins`);
      setMedecinsList(response.data);
      if (response.data.length > 0 && !patientForm.medecin) {
        setPatientForm(prev => ({ ...prev, medecin: response.data[0].nom }));
      }
    } catch (err) {
      console.error("Erreur chargement médecins:", err);
    }
  };

  useEffect(() => {
    fetchMedecins();
    if (currentUser) {
      fetchRdvs(currentUser);
    }
  }, [currentUser?.name, currentUser?.role]);

  // --- TRAITEMENT CONNEXION / INSCRIPTION ---
  const handleAuth = async (e) => {
    e.preventDefault();

    if (loginRole === 'patient') {
      if (isRegistering) {
        // Un nouveau patient est basculé directement vers l'espace de réservation de RDV
        const tempPatient = { role: 'patient', name: loginForm.nom || 'Nouveau Patient', email: loginForm.email };
        setCurrentUser(tempPatient);
        setPatientForm(prev => ({ ...prev, nom: loginForm.nom, email: loginForm.email, password: loginForm.password }));
      } else {
        // Connexion Patient existant
        if (!loginForm.email.trim() || !loginForm.password.trim()) {
          return alert('Veuillez saisir votre e-mail et votre code/mot de passe confidentiel.');
        }
        try {
          const res = await axios.post(`${API_BASE}/login-patient`, {
            email_patient: loginForm.email,
            password: loginForm.password
          });

          const userObj = { role: 'patient', name: res.data.patient, email: res.data.email_patient };
          setCurrentUser(userObj);
          setRdvs(res.data.rdvs || []);
          setPatientForm(prev => ({ ...prev, nom: res.data.patient, email: res.data.email_patient }));
        } catch (err) {
          alert(err.response?.data?.error || "Connexion patient échouée. Vérifiez vos identifiants.");
        }
      }
    } else {
      // Authentification Médecin
      if (isRegistering) {
        try {
          const res = await axios.post(`${API_BASE}/register-medecin`, loginForm);
          alert('Compte médecin créé avec succès !');
          const userObj = { role: 'medecin', name: res.data.nom, specialite: res.data.specialite, email: res.data.email };
          setCurrentUser(userObj);
          fetchMedecins();
          fetchRdvs(userObj);
        } catch (err) {
          alert(err.response?.data?.error || "Erreur lors de la création du compte.");
        }
      } else {
        try {
          const res = await axios.post(`${API_BASE}/login-medecin`, loginForm);
          const userObj = { role: 'medecin', name: res.data.nom, specialite: res.data.specialite, email: res.data.email };
          setCurrentUser(userObj);
          fetchRdvs(userObj);
        } catch (err) {
          alert(err.response?.data?.error || "Connexion médecin échouée.");
        }
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEditingRdvId(null);
    setSelectedRdv(null);
    setRdvs([]);
    setIsRegistering(false);
  };

  // --- ACTIONS PATIENT (RDV) ---
  const handleSaveRdv = async (e) => {
    e.preventDefault();
    if (!patientForm.medecin) {
      return alert("Veuillez sélectionner un médecin.");
    }

    try {
      if (editingRdvId) {
        await axios.patch(`${API_BASE}/rdv/${editingRdvId}/infos`, patientForm);
        alert('Rendez-vous modifié avec succès.');
        setEditingRdvId(null);
      } else {
        const res = await axios.post(`${API_BASE}/rdv`, patientForm);
        alert(`Rendez-vous enregistré !\n\n🔑 Votre code d'accès confidentiel est : ${res.data.password}\nNotez-le pour vous reconnecter ultérieurement.`);
      }
      
      setPatientForm(prev => ({ ...prev, age: '', date: '', motif: 'Consultation Générale', password: '' }));
      fetchRdvs(currentUser);
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de l'enregistrement.");
    }
  };

  const handleEditClick = (rdv) => {
    setEditingRdvId(rdv.id);
    setPatientForm({
      nom: rdv.patient || rdv.nom || '',
      email: rdv.email_patient || '',
      age: rdv.age || '',
      genre: rdv.genre || 'M',
      medecin: rdv.medecin || (medecinsList[0] ? medecinsList[0].nom : ''),
      date: rdv.date_rdv || '',
      motif: rdv.motif || '',
      type: rdv.type_consultation || rdv.type || 'Présentiel',
      password: rdv.password || ''
    });
  };

  const handleDeleteRdv = async (id) => {
    if (window.confirm("Supprimer ce rendez-vous ?")) {
      try {
        await axios.delete(`${API_BASE}/rdv/${id}`);
        fetchRdvs(currentUser);
      } catch (err) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  // --- ACTIONS MÉDECIN ---
  const handleUpdateStatus = async (id, status) => {
    try {
      await axios.patch(`${API_BASE}/rdv/${id}/statut`, { status });
      alert(`Rendez-vous ${status === 'CONFIRME' ? 'confirmé' : 'refusé'}. E-mail de notification envoyé au patient.`);
      fetchRdvs(currentUser);
    } catch (err) {
      alert('Erreur lors du changement de statut.');
    }
  };

  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    if (!selectedRdv) return;

    try {
      const payload = {
        consultation_data: {
          constantes: {
            tension: consultation.tension,
            pouls: consultation.pouls,
            temp: consultation.temp,
            poids: consultation.poids
          },
          diagnostic: consultation.diagnostic,
          notes: consultation.notes,
          ordonnance: prescriptions
        }
      };

      await axios.put(`${API_BASE}/rdv/${selectedRdv.id}`, payload);
      setSelectedRdv(null);
      setConsultation({ tension: '', pouls: '', temp: '', poids: '', diagnostic: '', notes: '' });
      setPrescriptions([{ medicament: '', posologie: '', duree: '' }]);
      fetchRdvs(currentUser);
      alert('Consultation terminée et dossier sauvegardé.');
    } catch (err) {
      alert('Erreur lors de la sauvegarde.');
    }
  };

  const filteredRdvsForMedecin = rdvs.filter(rdv => {
    if (!currentUser || currentUser.role !== 'medecin') return false;
    const isForThisMedecin = rdv.medecin.toLowerCase().includes(currentUser.name.toLowerCase()) || 
                             currentUser.name.toLowerCase().includes(rdv.medecin.toLowerCase());
    const matchesSearch = (rdv.patient || rdv.nom || '').toLowerCase().includes(searchQuery.toLowerCase());
    return isForThisMedecin && matchesSearch;
  });

  // =================ÉCRAN D'AUTHENTIFICATION=================
  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-box card">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <Stethoscope size={48} color="#0d9488" />
            <h2 style={{ margin: '0.5rem 0 0.2rem 0', color: '#0f172a' }}>MedSUITE Pro</h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>Portail Médical & Rendez-vous</p>
          </div>

          {/* Choix Rôle : Patient vs Médecin */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <button 
              className={`tab-btn ${loginRole === 'patient' ? 'active-patient' : ''}`}
              style={{ flex: 1, padding: '0.6rem' }}
              onClick={() => { setLoginRole('patient'); setIsRegistering(false); }}
            >
              <User size={16} /> Patient
            </button>
            <button 
              className={`tab-btn ${loginRole === 'medecin' ? 'active-medecin' : ''}`}
              style={{ flex: 1, padding: '0.6rem' }}
              onClick={() => { setLoginRole('medecin'); setIsRegistering(false); }}
            >
              <ShieldCheck size={16} /> Médecin
            </button>
          </div>

          <form onSubmit={handleAuth} className="form-group">
            {/* Nom complet requis pour Inscription Patient OU Métier Médecin */}
            {(isRegistering || loginRole === 'medecin') && (
              <div>
                <label className="label-title">
                  {loginRole === 'patient' ? 'Votre Nom complet' : 'Nom du Praticien'}
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder={loginRole === 'patient' ? 'Ex: Jean Dupont' : 'Ex: Dr. Rakoto'} 
                  value={loginForm.nom} 
                  onChange={e => setLoginForm({...loginForm, nom: e.target.value})} 
                  className="input-field" 
                />
              </div>
            )}

            <div>
              <label className="label-title">Adresse E-mail</label>
              <input 
                type="email" 
                required 
                placeholder="Ex: exemple@gmail.com" 
                value={loginForm.email} 
                onChange={e => setLoginForm({...loginForm, email: e.target.value})} 
                className="input-field" 
              />
            </div>

            {/* Spécialité si inscription médecin */}
            {loginRole === 'medecin' && isRegistering && (
              <div>
                <label className="label-title">Spécialité</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Généraliste, Cardiologue..." 
                  value={loginForm.specialite} 
                  onChange={e => setLoginForm({...loginForm, specialite: e.target.value})} 
                  className="input-field" 
                />
              </div>
            )}

            {/* Mot de passe ou Code Confidentiel */}
            {(!isRegistering || loginRole === 'medecin') && (
              <div>
                <label className="label-title">
                  {loginRole === 'patient' ? 'Code / Mot de passe confidentiel' : 'Mot de passe'}
                </label>
                <input 
                  type="password" 
                  required={!isRegistering}
                  placeholder={loginRole === 'patient' ? 'Code reçu lors du RDV' : '••••••••'} 
                  value={loginForm.password} 
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                  className="input-field" 
                />
              </div>
            )}

            <button 
              type="submit" 
              className={loginRole === 'patient' ? 'btn-primary-blue' : 'btn-primary-teal'} 
              style={{ marginTop: '0.5rem' }}
            >
              {loginRole === 'patient' 
                ? (isRegistering ? 'Prendre mon premier RDV' : 'Accéder à mes RDV') 
                : (isRegistering ? 'Créer mon compte Praticien' : 'Connexion Cabinet')}
            </button>
          </form>

          {/* Bascule Inscription / Connexion dynamique */}
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={() => setIsRegistering(!isRegistering)} 
              style={{ background: 'none', border: 'none', color: loginRole === 'patient' ? '#0284c7' : '#0f766e', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
            >
              {loginRole === 'patient'
                ? (isRegistering ? 'Déjà client ? Se connecter avec un code' : 'Nouveau patient ? Réserver directement un rendez-vous')
                : (isRegistering ? 'Déjà un compte médecin ? Se connecter' : 'Nouveau médecin ? Créer un compte cabinet')
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      <header className="app-header">
        <div className="brand">
          <Stethoscope size={32} />
          <span>MedSUITE <small>v2.0 Pro</small></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>{currentUser.name}</div>
            <small style={{ color: '#64748b', textTransform: 'capitalize' }}>
              Mode : {currentUser.role === 'patient' ? 'Patient' : `Médecin (${currentUser.specialite || 'Praticien'})`}
            </small>
          </div>
          <button onClick={handleLogout} className="btn-refuse" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.8rem' }}>
            <LogOut size={16} /> Deconnexion
          </button>
        </div>
      </header>

      {/* ================= ESPACE PATIENT ================= */}
      {currentUser.role === 'patient' && (
        <div className="grid-2col">
          <section className="card">
            <h3 className="card-title blue">
              {editingRdvId ? <Edit size={20} /> : <Plus size={20} />} 
              {editingRdvId ? 'Modifier le Rendez-vous' : 'Prise de Rendez-vous'}
            </h3>
            <form onSubmit={handleSaveRdv} className="form-group">
              <div>
                <label className="label-title">Nom du Patient</label>
                <input type="text" required value={patientForm.nom} onChange={e => setPatientForm({...patientForm, nom: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="label-title">Adresse E-mail du Patient</label>
                <input type="email" required placeholder="patient@gmail.com" value={patientForm.email} onChange={e => setPatientForm({...patientForm, email: e.target.value})} className="input-field" />
              </div>
              <div className="grid-inputs-2">
                <div>
                  <label className="label-title">Âge</label>
                  <input type="number" required value={patientForm.age} onChange={e => setPatientForm({...patientForm, age: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="label-title">Sexe</label>
                  <select value={patientForm.genre} onChange={e => setPatientForm({...patientForm, genre: e.target.value})} className="input-field">
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-title">Choix du Médecin</label>
                <select 
                  value={patientForm.medecin} 
                  onChange={e => setPatientForm({...patientForm, medecin: e.target.value})} 
                  className="input-field"
                  required
                >
                  {medecinsList.length === 0 && <option value="">Aucun médecin disponible</option>}
                  {medecinsList.map(m => (
                    <option key={m.id} value={m.nom}>
                      {m.nom} ({m.specialite})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-title">Motif de consultation</label>
                <input type="text" placeholder="Ex: Maux de tête, contrôle..." value={patientForm.motif} onChange={e => setPatientForm({...patientForm, motif: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="label-title">Date & Heure souhaitées</label>
                <input type="datetime-local" required value={patientForm.date} onChange={e => setPatientForm({...patientForm, date: e.target.value})} className="input-field" />
              </div>

              <div>
                <label className="label-title">Définir un Code Confidentiel (Optionnel)</label>
                <input type="password" placeholder="Laissez vide pour un code généré automatiquement" value={patientForm.password} onChange={e => setPatientForm({...patientForm, password: e.target.value})} className="input-field" />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary-blue">
                  {editingRdvId ? 'Enregistrer les modifications' : 'Confirmer le Rendez-vous'}
                </button>
                {editingRdvId && (
                  <button type="button" onClick={() => setEditingRdvId(null)} className="btn-refuse" style={{ padding: '0.5rem 1rem' }}>
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card">
            <h3 className="card-title slate"><Calendar size={20} /> Mes Rendez-vous & Historique</h3>
            <div>
              {rdvs.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Aucun rendez-vous enregistré à cet e-mail.</p>
              ) : (
                rdvs.map(item => (
                  <div key={item.id} className="rdv-item">
                    <div>
                      <strong>{item.patient || item.nom}</strong> ({item.age} ans)
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.motif} — Dr: {item.medecin}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📅 {item.date_rdv}</div>
                      {item.password && <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>🔑 Code accès : {item.password}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span className={`badge ${item.status}`}>{item.status}</span>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {item.status === 'TERMINE' && item.consultation_data && (
                          <button onClick={() => setViewDetailsRdv(item)} className="btn-consult" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                            <Eye size={14} /> Voir Bilan
                          </button>
                        )}
                        <button onClick={() => handleEditClick(item)} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }} title="Modifier">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteRdv(item.id)} className="btn-delete" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* ================= ESPACE MÉDICAL ================= */}
      {currentUser.role === 'medecin' && (
        <div className={`grid-medecin ${selectedRdv ? 'with-consultation' : ''}`}>
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card-title teal" style={{ margin: 0 }}>
                <HeartPulse size={20} /> Patients de {currentUser.name}
              </h3>
              <input 
                type="text" 
                placeholder="Rechercher patient..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ width: '180px', marginTop: 0 }}
              />
            </div>

            <div>
              {filteredRdvsForMedecin.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Aucun rendez-vous planifié.</p>
              ) : (
                filteredRdvsForMedecin.map((rdv) => (
                  <div key={rdv.id} className="rdv-item">
                    <div>
                      <strong>{rdv.patient || rdv.nom}</strong> ({rdv.genre}, {rdv.age} ans)
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Motif: {rdv.motif}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📅 {rdv.date_rdv}</div>
                      {rdv.email_patient && <div style={{ fontSize: '0.75rem', color: '#0369a1' }}>✉️ {rdv.email_patient}</div>}
                      <div style={{ marginTop: '4px' }}>
                        <span className={`badge ${rdv.status}`}>{rdv.status}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {rdv.status === 'EN_ATTENTE' && (
                        <>
                          <button onClick={() => handleUpdateStatus(rdv.id, 'CONFIRME')} className="btn-confirm">✓ Confirm</button>
                          <button onClick={() => handleUpdateStatus(rdv.id, 'REFUSE')} className="btn-refuse">✕ Refuser</button>
                        </>
                      )}

                      {rdv.status === 'CONFIRME' && (
                        <button onClick={() => setSelectedRdv(rdv)} className="btn-consult">
                          🩺 Consulter
                        </button>
                      )}

                      {rdv.status === 'TERMINE' && (
                        <button onClick={() => setViewDetailsRdv(rdv)} className="btn-consult" style={{ background: '#0284c7' }}>
                          <Eye size={16} /> Fiche Médicale
                        </button>
                      )}

                      <button onClick={() => handleDeleteRdv(rdv.id)} className="btn-delete" title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Module consultation */}
          {selectedRdv && (
            <section className="card consultation-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <h3 className="card-title teal" style={{ margin: 0 }}>
                  <Activity size={20} /> Consultation: {selectedRdv.patient || selectedRdv.nom}
                </h3>
                <button onClick={() => setSelectedRdv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveConsultation} className="form-group">
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>1. Constantes Vitales</h4>
                  <div className="grid-inputs-4">
                    <input type="text" placeholder="Tension (12/8)" value={consultation.tension} onChange={e => setConsultation({...consultation, tension: e.target.value})} className="input-field" />
                    <input type="number" placeholder="Pouls (bpm)" value={consultation.pouls} onChange={e => setConsultation({...consultation, pouls: e.target.value})} className="input-field" />
                    <input type="text" placeholder="Temp (°C)" value={consultation.temp} onChange={e => setConsultation({...consultation, temp: e.target.value})} className="input-field" />
                    <input type="number" placeholder="Poids (kg)" value={consultation.poids} onChange={e => setConsultation({...consultation, poids: e.target.value})} className="input-field" />
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>2. Examen Clinique & Diagnostic</h4>
                  <textarea placeholder="Observations..." required rows={3} value={consultation.diagnostic} onChange={e => setConsultation({...consultation, diagnostic: e.target.value})} className="input-field" />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>3. Prescriptions</h4>
                    <button type="button" onClick={() => setPrescriptions([...prescriptions, { medicament: '', posologie: '', duree: '' }])} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}>+ Médicament</button>
                  </div>
                  
                  {prescriptions.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="Médicament" value={item.medicament} onChange={e => {
                        const updated = [...prescriptions];
                        updated[index].medicament = e.target.value;
                        setPrescriptions(updated);
                      }} className="input-field" />
                      <input type="text" placeholder="Posologie" value={item.posologie} onChange={e => {
                        const updated = [...prescriptions];
                        updated[index].posologie = e.target.value;
                        setPrescriptions(updated);
                      }} className="input-field" />
                      <input type="text" placeholder="Durée" value={item.duree} onChange={e => {
                        const updated = [...prescriptions];
                        updated[index].duree = e.target.value;
                        setPrescriptions(updated);
                      }} className="input-field" />
                      {prescriptions.length > 1 && (
                        <button type="button" onClick={() => setPrescriptions(prescriptions.filter((_, i) => i !== index))} className="btn-delete">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button type="submit" className="btn-primary-teal">
                  <FileText size={18} /> Clôturer et Archiver
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      {/* ================= MODALE FICHE / ORDONNANCE ================= */}
      {viewDetailsRdv && viewDetailsRdv.consultation_data && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f766e', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f766e', fontSize: '1.25rem' }}>Compte-Rendu de Consultation</h2>
                <small style={{ color: '#64748b' }}>Praticien: {viewDetailsRdv.medecin}</small>
              </div>
              <button onClick={() => setViewDetailsRdv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              <strong>Patient :</strong> {viewDetailsRdv.patient || viewDetailsRdv.nom} ({viewDetailsRdv.genre}, {viewDetailsRdv.age} ans)<br />
              <strong>E-mail :</strong> {viewDetailsRdv.email_patient || 'Non renseigné'}<br />
              <strong>Motif :</strong> {viewDetailsRdv.motif}
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Constantes Vitales</h4>
            <div className="grid-inputs-4" style={{ marginBottom: '1rem' }}>
              <div className="vital-box"><small style={{ color: '#64748b' }}>Tension</small><div><strong>{viewDetailsRdv.consultation_data.constantes?.tension || '-'}</strong></div></div>
              <div className="vital-box"><small style={{ color: '#64748b' }}>Pouls</small><div><strong>{viewDetailsRdv.consultation_data.constantes?.pouls ? `${viewDetailsRdv.consultation_data.constantes.pouls} bpm` : '-'}</strong></div></div>
              <div className="vital-box"><small style={{ color: '#64748b' }}>Température</small><div><strong>{viewDetailsRdv.consultation_data.constantes?.temp ? `${viewDetailsRdv.consultation_data.constantes.temp} °C` : '-'}</strong></div></div>
              <div className="vital-box"><small style={{ color: '#64748b' }}>Poids</small><div><strong>{viewDetailsRdv.consultation_data.constantes?.poids ? `${viewDetailsRdv.consultation_data.constantes.poids} kg` : '-'}</strong></div></div>
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Diagnostic</h4>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {viewDetailsRdv.consultation_data.diagnostic}
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Ordonnance</h4>
            {viewDetailsRdv.consultation_data.ordonnance?.length > 0 ? (
              <table className="prescription-table">
                <thead>
                  <tr>
                    <th>Médicament</th>
                    <th>Posologie</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {viewDetailsRdv.consultation_data.ordonnance.map((med, idx) => (
                    <tr key={idx}>
                      <td><strong>{med.medicament}</strong></td>
                      <td>{med.posologie}</td>
                      <td>{med.duree}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Aucune prescription.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button onClick={() => window.print()} className="btn-primary-blue" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                <Printer size={16} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;