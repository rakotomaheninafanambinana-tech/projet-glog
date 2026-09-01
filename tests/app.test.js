const request = require('supertest');
const app = require('../backend/server'); // Remonte d'un cran (out of tests) puis entre dans backend/server

describe('API MedSUITE - Gestion des Rendez-vous', () => {

  it('GET /api/rdv -> Doit retourner un statut 200 et un tableau', async () => {
    const res = await request(app).get('/api/rdv');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/rdv -> Doit rejeter une requête incomplète (statut 400)', async () => {
    const res = await request(app)
      .post('/api/rdv')
      .send({ patient: 'Jean Dupont' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/rdv -> Doit créer un nouveau RDV (statut 201)', async () => {
    const newRdv = {
      nom: 'Alice Test',
      medecin: 'Dr. Martin',
      date: `2026-10-10 14:00_${Date.now()}`
    };

    const res = await request(app)
      .post('/api/rdv')
      .send(newRdv);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('EN_ATTENTE');
  });

});