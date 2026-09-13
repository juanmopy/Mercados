import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashOperatorCode(code: string): string {
  const salt = process.env.OPERATOR_CODE_SALT ?? 'default-salt';
  return crypto.createHash('sha256').update(code + salt).digest('hex');
}

async function main() {
  console.log('Iniciando seed...');

  // 1. Create admin
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@mercados.gov.co').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin2026$Mercados';
  const adminName = process.env.ADMIN_NAME ?? 'Administrador Principal';

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash: bcrypt.hashSync(adminPassword, 10), name: adminName },
    create: {
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPassword, 10),
      name: adminName,
      isActive: true,
    },
  });
  console.log(`Admin creado: ${adminEmail}`);

  // 2. Create test operators
  const testOperators = [
    { name: 'Carlos Rodr\u00edguez', code: '1234' },
    { name: 'Mar\u00eda Gonz\u00e1lez', code: '5678' },
    { name: 'Luis P\u00e9rez', code: '9012' },
  ];

  for (const op of testOperators) {
    const codeHash = hashOperatorCode(op.code);
    await prisma.operator.upsert({
      where: { codeHash },
      update: { name: op.name },
      create: { name: op.name, codeHash, isActive: true },
    });
    console.log(`Operador creado: ${op.name} (c\u00f3digo: ${op.code})`);
  }

  // 3. Create test jornada
  const admin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!admin) { console.error('Admin no encontrado'); return; }

  const existingJornada = await prisma.jornada.findFirst({ where: { description: 'Entrega de Mercados - Jornada Prueba 2026' } });
  let jornada;
  if (existingJornada) {
    jornada = existingJornada;
    console.log('Jornada de prueba ya existe');
  } else {
    jornada = await prisma.jornada.create({
      data: {
        description: 'Entrega de Mercados - Jornada Prueba 2026',
        officialDate: new Date('2026-09-15'),
        status: 'CONFIGURADA',
        allowEarly: true,
        allowLate: true,
        createdByAdminId: admin.id,
      },
    });
    console.log('Jornada de prueba creada');
  }

  // 4. Create test beneficiaries
  const testBeneficiaries = [
    { fullName: 'Ana Mar\u00eda L\u00f3pez Mart\u00ednez', cedula: '1234567890' },
    { fullName: 'Jos\u00e9 Antonio Ram\u00edrez Silva', cedula: '2345678901' },
    { fullName: 'Carmen Rosa Torres Vega', cedula: '3456789012' },
    { fullName: 'Pedro Pablo Moreno Castro', cedula: '4567890123' },
    { fullName: 'Luz Marina Hern\u00e1ndez D\u00edaz', cedula: '5678901234' },
    { fullName: 'Jorge Enrique Vargas Ortiz', cedula: '6789012345' },
    { fullName: 'Rosa Elena Pinz\u00f3n Casta\u00f1eda', cedula: '7890123456' },
    { fullName: 'Manuel Fernando Guti\u00e9rrez Rojas', cedula: '8901234567' },
    { fullName: 'Mar\u00eda Isabel S\u00e1nchez Pardo', cedula: '9012345678' },
    { fullName: 'Carlos Alberto M\u00e9ndez Rueda', cedula: '1023456789' },
    { fullName: 'Gladys Patricia Romero Bello', cedula: '1123456780' },
    { fullName: 'Ra\u00fal Ernesto Cort\u00e9s Amaya', cedula: '1223456781' },
    { fullName: 'Blanca Cecilia Ni\u00f1o Arias', cedula: '1323456782' },
    { fullName: 'Humberto Le\u00f3n Parra Quintero', cedula: '1423456783' },
    { fullName: 'Olga Luc\u00eda Ospina Garz\u00f3n', cedula: '1523456784' },
    { fullName: 'Fabio Andr\u00e9s Acosta Pe\u00f1a', cedula: '1623456785' },
    { fullName: 'Esperanza del Carmen Roa L\u00f3pez', cedula: '1723456786' },
    { fullName: 'Gustavo Adolfo Pati\u00f1o Due\u00f1as', cedula: '1823456787' },
    { fullName: 'Teresa de Jes\u00fas Bernal Suarez', cedula: '1923456788' },
    { fullName: 'Alfredo Jos\u00e9 Camacho Brice\u00f1o', cedula: '2023456789' },
  ];

  for (const b of testBeneficiaries) {
    await prisma.beneficiary.upsert({
      where: { jornadaId_cedula: { jornadaId: jornada.id, cedula: b.cedula } },
      update: { fullName: b.fullName },
      create: { fullName: b.fullName, cedula: b.cedula, jornadaId: jornada.id },
    });
  }
  console.log(`${testBeneficiaries.length} beneficiarios de prueba creados`);

  console.log('Seed completado exitosamente.');
}

main()
  .catch((e) => { console.error('Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
