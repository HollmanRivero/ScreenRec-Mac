#!/usr/bin/env node
const crypto = require('crypto')

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let part1 = ''
  let part2 = ''
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length))
    part2 += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  const check = crypto.createHash('sha256')
    .update(`SCREC-SALT-2026-${part1}-${part2}`)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase()

  return `SCREC-${part1}-${part2}-${check}`
}

const count = parseInt(process.argv[2], 10) || 1
console.log(`\n=== ScreenRec Lisensnøkkel-Generator ===`)
console.log(`Eier: Hollman Enrique Salazar Rivero\n`)
for (let i = 0; i < count; i++) {
  console.log(`[Lisens ${i + 1}]: ${generateKey()}`)
}
console.log(`\nMaster-nøkler: SCREC-HOLLMAN-PRO-2026, SCREC-LIFETIME-PRO\n`)
