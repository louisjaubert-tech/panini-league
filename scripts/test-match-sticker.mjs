#!/usr/bin/env node
/**
 * Usage: node scripts/test-match-sticker.mjs
 *
 * Appelle POST /api/match-sticker avec des données de test et affiche la réponse.
 * Le serveur Next.js doit être lancé sur http://localhost:3000.
 */

const BASE_URL = 'http://localhost:3000'

const payload = {
  pack_id: '00000000-0000-0000-0000-000000000000',
  user_id: 'aa35b926-03c8-42d5-af70-ba1299ddaa84',
  blocs: [
    'DIOGO DALOT 18-3-1999 1.83 m / 78 kg MANCHESTER UNITED FC (ENG)',
    'SEUNGHO PAIK 17-3-1987 11,82 m / 68 kg BIRMINGHAM CITY FC ENG',
  ],
}

console.log('📤  POST', `${BASE_URL}/api/match-sticker`)
console.log('    Payload :')
console.log(JSON.stringify(payload, null, 2))
console.log()

const res = await fetch(`${BASE_URL}/api/match-sticker`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

console.log(`📥  Status : ${res.status} ${res.statusText}`)
console.log()

const data = await res.json()
console.log('📋  Réponse :')
console.log(JSON.stringify(data, null, 2))
