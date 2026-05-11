/* eslint-disable @typescript-eslint/no-require-imports */
import * as path from 'path';
import * as fs from 'fs';

// Cargar .env manualmente
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma/client');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL no encontrada en .env');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email    = 'admin@modaia.com';
  const password = 'Admin1234!';
  const name     = 'Administrador';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`⚠️  Ya existe un usuario con email: ${email}`);
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
      console.log('✅  Rol actualizado a ADMIN');
    } else {
      console.log('   Ya es ADMIN, no se realizaron cambios.');
    }
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { email, name, password: hashedPassword, role: 'ADMIN' },
  });

  console.log('✅  Admin creado:');
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Rol:      ${admin.role}`);
}

main()
  .catch((e) => { console.error('❌  Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
