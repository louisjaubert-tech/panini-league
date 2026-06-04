#!/usr/bin/env node
/**
 * Usage: node scripts/test-check-badges.mjs
 *
 * Appelle POST /api/check-badges et affiche la réponse complète.
 * Le serveur Next.js doit être lancé sur http://localhost:3000.
 */

const BASE_URL = 'http://localhost:3000'
const USER_ID  = 'aa35b926-03c8-42d5-af70-ba1299ddaa84'

const payload = { user_id: USER_ID }

console.log(`📤  POST ${BASE_URL}/api/check-badges`)
console.log(`    Payload : ${JSON.stringify(payload)}`)
console.log()

const res = await fetch(`${BASE_URL}/api/check-badges`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

console.log(`📥  Status : ${res.status} ${res.statusText}`)
console.log()

const data = await res.json()
console.log('📋  Réponse :')
console.log(JSON.stringify(data, null, 2))
