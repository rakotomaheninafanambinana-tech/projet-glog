import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Stethoscope, User, Calendar, ShieldCheck, Plus, X, 
  Activity, FileText, HeartPulse, Trash2, Eye, Printer, Edit 
} from 'lucide-react';
import './App.css';

const API_URL = 'https://projet-glog-backend1.onrender.com/api/rdv';

function App() {
  const [activeTab, setActiveTab] = useState('medecin');
  const [rdvs, setRdvs] = useState([]);
  const [selectedRdv, setSelectedRdv] = useState(null); // Pour la consultation en cours
  const [viewDetailsRdv, setViewDetailsRdv] = useState(null); // Pour la lecture du bilan terminé
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRdvId, setEditingRdvId] = useState(null); // Pour savoir si on est en mode édition

  // Formulaire Patient
  const [patientForm, setPatientForm] = useState({
    nom: '', age: '', genre: 'M', medecin: 'Dr. Rakoto (Généraliste)', 
    date: '', motif: 'Consultation Générale', type: 'Présentiel'
  });

  // Formulaire Consultation Médecin
  const [consultation, setConsultation] = useState({
    tension: '', pouls: '', temp: '', poids: '', diagnostic: '', notes: ''
  });
  const [prescriptions, setPrescriptions] = useState([{ medicament: '', posologie: '', duree: '' }]);

  const fetchRdvs = async () => {
    try {
      const response = await axios.get(API_URL);
      setRdvs(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRdvs();
  }, []);

  const handleAddMed = () => setPrescriptions([...prescriptions, { medicament: '', posologie: '', duree: '' }]);
  const handleRemoveMed = (index) => setPrescriptions(prescriptions.filter((_, i) => i !== index));
  const handleMedChange = (index, field, val) => {
    const updated = [...prescriptions];
    updated[index][field] = val;
    setPrescriptions(updated);
  };

  // --- CRUD PATIENT : CREATION & MODIFICATION ---
  const handleSaveRdv = async (e) => {
    e.preventDefault();
    try {
      if (editingRdvId) {
        // CORRECTION ICI : On modifie uniquement les informations du rendez-vous
        // sans toucher au statut de consultation
        await axios.patch(`${API_URL}/${editingRdvId}/infos`, patientForm);
        alert('Rendez-vous modifié avec succès.');
        setEditingRdvId(null);
      } else {
        // CREATE (Création d'un nouveau RDV)
        await axios.post(API_URL, patientForm);
        alert('Demande de consultation transmise avec succès.');
      }
      setPatientForm({ nom: '', age: '', genre: 'M', medecin: 'Dr. Rakoto (Généraliste)', date: '', motif: 'Consultation Générale', type: 'Présentiel' });
      fetchRdvs();
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de l'enregistrement.");
    }
  };

  const handleEditClick = (rdv) => {
    setEditingRdvId(rdv.id);
    setPatientForm({
      nom: rdv.nom || '',
      age: rdv.age || '',
      genre: rdv.genre || 'M',
      medecin: rdv.medecin || 'Dr. Rakoto (Généraliste)',
      date: rdv.date_rdv || '',
      motif: rdv.motif || '',
      type: rdv.type || 'Présentiel'
    });
    setActiveTab('patient'); // Redirige vers l'onglet patient pour modifier le formulaire
  };

  const handleCancelEdit = () => {
    setEditingRdvId(null);
    setPatientForm({ nom: '', age: '', genre: 'M', medecin: 'Dr. Rakoto (Généraliste)', date: '', motif: 'Consultation Générale', type: 'Présentiel' });
  };

  // --- CRUD : SUPPRESSION ---
  const handleDeleteRdv = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce rendez-vous ?")) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        fetchRdvs();
        alert("Rendez-vous supprimé.");
      } catch (err) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  // --- STATUT ET CONSULTATION ---
  const handleUpdateStatus = async (id, status) => {
    try {
      await axios.patch(`${API_URL}/${id}/statut`, { status });
      fetchRdvs();
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

      await axios.put(`${API_URL}/${selectedRdv.id}`, payload);
      setSelectedRdv(null);
      setConsultation({ tension: '', pouls: '', temp: '', poids: '', diagnostic: '', notes: '' });
      setPrescriptions([{ medicament: '', posologie: '', duree: '' }]);
      fetchRdvs();
      alert('Consultation terminée et dossier sauvegardé.');
    } catch (err) {
      alert('Erreur lors de la sauvegarde.');
    }
  };

  return (
    <div className="app-container">
      
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <Stethoscope size={32} />
          <span>MedSUITE <small>v2.0 Pro</small></span>
        </div>
        <div className="tab-switcher">
          <button 
            className={`tab-btn ${activeTab === 'patient' ? 'active-patient' : ''}`}
            onClick={() => setActiveTab('patient')}
          >
            <User size={16} /> Espace Patient
          </button>
          <button 
            className={`tab-btn ${activeTab === 'medecin' ? 'active-medecin' : ''}`}
            onClick={() => setActiveTab('medecin')}
          >
            <ShieldCheck size={16} /> Espace Médical
          </button>
        </div>
      </header>

      {/* ================= ESPACE PATIENT ================= */}
      {activeTab === 'patient' && (
        <div className="grid-2col">
          <section className="card">
            <h3 className="card-title blue">
              {editingRdvId ? <Edit size={20} /> : <Plus size={20} />} 
              {editingRdvId ? 'Modifier la Demande' : 'Demande de Consultation'}
            </h3>
            <form onSubmit={handleSaveRdv} className="form-group">
              <div>
                <label className="label-title">Nom Complet</label>
                <input type="text" required value={patientForm.nom} onChange={e => setPatientForm({...patientForm, nom: e.target.value})} className="input-field" />
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
                <label className="label-title">Médecin Praticien</label>
                <select value={patientForm.medecin} onChange={e => setPatientForm({...patientForm, medecin: e.target.value})} className="input-field">
                  <option value="Dr. Rakoto (Généraliste)">Dr. Rakoto (Généraliste)</option>
                  <option value="Dr. Rasoa (Cardiologue)">Dr. Rasoa (Cardiologue)</option>
                </select>
              </div>
              <div>
                <label className="label-title">Motif de consultation</label>
                <input type="text" placeholder="Ex: Maux de tête, suivi..." value={patientForm.motif} onChange={e => setPatientForm({...patientForm, motif: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="label-title">Date & Heure souhaitées</label>
                <input type="datetime-local" required value={patientForm.date} onChange={e => setPatientForm({...patientForm, date: e.target.value})} className="input-field" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn-primary-blue">
                  {editingRdvId ? 'Enregistrer les modifications' : 'Confirmer la demande'}
                </button>
                {editingRdvId && (
                  <button type="button" onClick={handleCancelEdit} className="btn-refuse" style={{ padding: '0.5rem 1rem' }}>
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card">
            <h3 className="card-title slate"><Calendar size={20} /> Mes Rendez-vous & Bilan</h3>
            <div>
              {rdvs.map(item => (
                <div key={item.id} className="rdv-item">
                  <div>
                    <strong>{item.nom}</strong> ({item.age} ans)
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.motif} — {item.medecin}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📅 {item.date_rdv}</div>
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
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ================= ESPACE MÉDICAL ================= */}
      {activeTab === 'medecin' && (
        <div className={`grid-medecin ${selectedRdv ? 'with-consultation' : ''}`}>
          
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="card-title teal" style={{ margin: 0 }}>
                <HeartPulse size={20} /> Salle d'attente
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
              {rdvs.filter(r => r.nom?.toLowerCase().includes(searchQuery.toLowerCase())).map((rdv) => (
                <div key={rdv.id} className="rdv-item">
                  <div>
                    <strong>{rdv.nom}</strong> ({rdv.genre}, {rdv.age} ans)
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Motif: {rdv.motif}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📅 {rdv.date_rdv}</div>
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

                    <button onClick={() => handleEditClick(rdv)} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer' }} title="Modifier">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDeleteRdv(rdv.id)} className="btn-delete" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Module de Saisie Consultation */}
          {selectedRdv && (
            <section className="card consultation-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', pb: '0.5rem', marginBottom: '1rem' }}>
                <h3 className="card-title teal" style={{ margin: 0 }}>
                  <Activity size={20} /> Consultation: {selectedRdv.nom}
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
                    <button type="button" onClick={handleAddMed} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}>+ Médicament</button>
                  </div>
                  
                  {prescriptions.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="Médicament" value={item.medicament} onChange={e => handleMedChange(index, 'medicament', e.target.value)} className="input-field" />
                      <input type="text" placeholder="Posologie" value={item.posologie} onChange={e => handleMedChange(index, 'posologie', e.target.value)} className="input-field" />
                      <input type="text" placeholder="Durée" value={item.duree} onChange={e => handleMedChange(index, 'duree', e.target.value)} className="input-field" />
                      {prescriptions.length > 1 && (
                        <button type="button" onClick={() => handleRemoveMed(index)} className="btn-delete">
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

      {/* ================= MODALE AFFICHAGE DOSSIER / ORDONNANCE ================= */}
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

            {/* Infos Patient */}
            <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              <strong>Patient :</strong> {viewDetailsRdv.nom} ({viewDetailsRdv.genre}, {viewDetailsRdv.age} ans)<br />
              <strong>Motif initial :</strong> {viewDetailsRdv.motif}
            </div>

            {/* Constantes */}
            <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Constantes Vitales</h4>
            <div className="grid-inputs-4" style={{ marginBottom: '1rem' }}>
              <div className="vital-box">
                <small style={{ color: '#64748b' }}>Tension</small>
                <div><strong>{viewDetailsRdv.consultation_data.constantes?.tension || '-'}</strong></div>
              </div>
              <div className="vital-box">
                <small style={{ color: '#64748b' }}>Pouls</small>
                <div><strong>{viewDetailsRdv.consultation_data.constantes?.pouls ? `${viewDetailsRdv.consultation_data.constantes.pouls} bpm` : '-'}</strong></div>
              </div>
              <div className="vital-box">
                <small style={{ color: '#64748b' }}>Température</small>
                <div><strong>{viewDetailsRdv.consultation_data.constantes?.temp ? `${viewDetailsRdv.consultation_data.constantes.temp} °C` : '-'}</strong></div>
              </div>
              <div className="vital-box">
                <small style={{ color: '#64748b' }}>Poids</small>
                <div><strong>{viewDetailsRdv.consultation_data.constantes?.poids ? `${viewDetailsRdv.consultation_data.constantes.poids} kg` : '-'}</strong></div>
              </div>
            </div>

            {/* Diagnostic */}
            <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Diagnostic / Bilan</h4>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {viewDetailsRdv.consultation_data.diagnostic}
            </div>

            {/* Ordonnance */}
            <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Ordonnance Médicamenteuse</h4>
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
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Aucune prescription médicale.</p>
            )}

            {/* Boutons d'action modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button onClick={() => window.print()} className="btn-primary-blue" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                <Printer size={16} /> Imprimer Ordonnance
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;