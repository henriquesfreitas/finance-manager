import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const username = 'pedro';
const budgetName = 'Casa Boa Vista';
const bcryptCostFactor = 12;

const budgetItems = [
  { date: '2025-04-30', value: 1040, description: 'Cimento', additionalInfo: '30 sacos; anotação: já peguei 5, restam 25' },
  { date: '2025-05-08', value: 1500, description: 'Bernardo', additionalInfo: 'Sobre a empreitada' },
  { date: '2025-05-09', value: 1700, description: 'Poste', additionalInfo: 'Boa Vista' },
  { date: '2025-05-15', value: 170, description: 'Cimento', additionalInfo: '5 sacos' },
  { date: '2025-05-22', value: 341, description: 'Tábua', additionalInfo: null },
  { date: '2025-06-02', value: 740, description: 'Cimento', additionalInfo: '20 sacos' },
  { date: '2025-06-06', value: 70, description: 'Pingadeira', additionalInfo: '5 metros' },
  { date: '2025-06-06', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-06-12', value: 1200, description: 'Aterro e máquina', additionalInfo: 'Casa' },
  { date: '2025-06-13', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-06-17', value: 100, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-06-24', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-06-24', value: 1450, description: 'Material de construção', additionalInfo: 'Ferro e tábua' },
  { date: '2025-06-27', value: 700, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-03', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-03', value: 2600, description: 'Gaguinho', additionalInfo: 'Máquina e aterro' },
  { date: '2025-07-04', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-07', value: 300, description: 'Leonardo Creia', additionalInfo: null },
  { date: '2025-07-09', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-15', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-18', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-22', value: 150, description: 'Pedreiro', additionalInfo: null },
  { date: '2025-07-29', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-07-30', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-08-05', value: 150, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-08-05', value: 0, description: 'Cimento', additionalInfo: '5 sacos' },
  { date: '2025-08-08', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-08-15', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-08-20', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-08-21', value: 840, description: 'Material: ferro e laje', additionalInfo: 'Construção' },
  { date: '2025-09-08', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-09-12', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-09-17', value: 4500, description: 'Chuverinho', additionalInfo: 'Armação' },
  { date: '2025-09-17', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-09-18', value: 4500, description: 'Chuverinho', additionalInfo: 'Armação' },
  { date: '2025-09-19', value: 2000, description: 'Chuverinho', additionalInfo: 'Armação' },
  { date: '2025-09-20', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-09-24', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-01', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-01', value: 52, description: 'Dobradiça', additionalInfo: 'Henrique' },
  { date: '2025-10-04', value: 150, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-07', value: 390, description: 'Cimento', additionalInfo: 'Obra' },
  { date: '2025-10-07', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-13', value: 740, description: 'Gaguinho', additionalInfo: 'Areia de reboco' },
  { date: '2025-10-14', value: 65, description: 'Cal e arame', additionalInfo: 'Obra' },
  { date: '2025-10-16', value: 600, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-24', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-28', value: 150, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-10-31', value: 250, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-11-04', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-11-07', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-11-10', value: 657, description: 'Madeira', additionalInfo: 'Casa' },
  { date: '2025-11-14', value: 250, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-11-20', value: 600, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-11-25', value: 400, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-11-27', value: 580, description: 'Bacio completo', additionalInfo: 'Obra' },
  { date: '2025-11-28', value: 217, description: 'Tomada', additionalInfo: 'Casa' },
  { date: '2025-12-01', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-12-03', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-12-09', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento' },
  { date: '2025-12-12', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; área' },
  { date: '2025-12-14', value: 182, description: 'Calha de alumínio', additionalInfo: 'Chapa; Henrique' },
  { date: '2025-12-16', value: 1900, description: 'Roçadeira', additionalInfo: 'Sangão; compra' },
  { date: '2025-12-18', value: 1000, description: 'Pedreiro', additionalInfo: 'Área' },
  { date: '2025-12-23', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; área' },
  { date: '2025-12-23', value: 354, description: 'Material de construção', additionalInfo: 'Marisa' },
  { date: '2026-01-07', value: 150, description: 'Pedreiro', additionalInfo: 'Adiantamento; área' },
  { date: '2026-01-09', value: 850, description: 'Pedreiro', additionalInfo: 'Restante da empreitada; área' },
  { date: '2026-01-15', value: 400, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-01-21', value: 100, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-01-23', value: 1400, description: 'Pedreiro', additionalInfo: 'Casa' },
  { date: '2026-01-28', value: 400, description: 'Cimento', additionalInfo: '10 sacos; casa' },
  { date: '2026-01-30', value: 140, description: 'Forro', additionalInfo: '3 metros; casa' },
  { date: '2026-02-03', value: 400, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-02-06', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-02-12', value: 520, description: 'Cimento', additionalInfo: '13 sacos; casa' },
  { date: '2026-02-13', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-02-19', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-02-27', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-03-02', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-03-05', value: 297, description: 'Fio', additionalInfo: 'Casa; anotação: Fio 06_04' },
  { date: '2026-03-06', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-03-10', value: 150, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-03-11', value: 1350, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-03-19', value: 1000, description: 'Gaguinho', additionalInfo: 'Serviço de máquina; anotação original: “4,40 minuto de serviço”' },
  { date: '2026-03-24', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-03-25', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-03-27', value: 1540, description: 'Material de construção', additionalInfo: 'Varanda; Marisa' },
  { date: '2026-04-02', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-04-07', value: 990, description: 'Fio', additionalInfo: 'Casa; Celesp' },
  { date: '2026-04-10', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-04-13', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-04-16', value: 600, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-04-20', value: 641, description: 'Piso', additionalInfo: 'Casa; Lelei Telhas' },
  { date: '2026-04-20', value: 1700, description: 'Piso', additionalInfo: 'Casa; Deivide; Lelei Telhas' },
  { date: '2026-04-23', value: 550, description: 'Churrasqueira', additionalInfo: 'Casa; Lelei Telhas' },
  { date: '2026-04-24', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-04-29', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-04-29', value: 730, description: 'Forro', additionalInfo: 'Adiantamento; Martelo' },
  { date: '2026-04-29', value: 1460, description: 'Forro', additionalInfo: 'Duas prestações; Martelo; feito em 5 vezes' },
  { date: '2026-05-07', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento em dinheiro; varanda' },
  { date: '2026-05-09', value: 300, description: 'Pedreiro', additionalInfo: 'Pagamento ao Bernardo; varanda' },
  { date: '2026-05-14', value: 1300, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-05-18', value: 757, description: 'Brita', additionalInfo: 'Pagamento ao Gaguinho' },
  { date: '2026-05-22', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-05-25', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-05-30', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-06-04', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-06-11', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-06-15', value: 1000, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-06-19', value: 100, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-06-23', value: 1500, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-07-02', value: 750, description: 'Pedreiro', additionalInfo: 'Adiantamento ao Bernardo; varanda' },
  { date: '2026-07-08', value: 250, description: 'Pedreiro', additionalInfo: 'Adiantamento da varanda' },
  { date: '2026-07-09', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento da varanda' },
  { date: '2026-07-14', value: 276, description: 'Material de construção', additionalInfo: 'Cimento e ferro' },
  { date: '2026-07-15', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento da varanda' },
  { date: '2026-07-17', value: 700, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-07-24', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-07-25', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-07-31', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento; varanda' },
  { date: '2026-08-06', value: 1700, description: 'Pedreiro', additionalInfo: 'Adiantamento da varanda' },
  { date: '2026-08-12', value: 250, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-08-14', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
  { date: '2026-08-18', value: 250, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-08-21', value: 100, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-08-22', value: 800, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
  { date: '2026-08-28', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-09-01', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
  { date: '2026-09-04', value: 280, description: 'Maquita', additionalInfo: 'Máquina; Bernardo' },
  { date: '2026-09-05', value: 300, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-09-09', value: 100, description: 'Pedreiro', additionalInfo: 'Adiantamento; casa' },
  { date: '2026-09-09', value: 400, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
  { date: '2026-09-10', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
  { date: '2026-10-16', value: 500, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
  { date: '2026-10-18', value: 200, description: 'Pedreiro', additionalInfo: 'Adiantamento da casa' },
] as const;

function itemKey(item: { value: unknown; itemDate: Date | string; description: string | null; additionalInfo: string | null; isPaid: boolean }): string {
  const date = item.itemDate instanceof Date ? item.itemDate.toISOString().slice(0, 10) : item.itemDate.slice(0, 10);
  return JSON.stringify([date, Number(item.value).toFixed(2), item.description, item.additionalInfo, item.isPaid]);
}

async function main(): Promise<void> {
  const password = process.env['PEDRO_PASSWORD'];
  if (!password || password.length < 8 || password.length > 128) {
    throw new Error('PEDRO_PASSWORD must be set and contain between 8 and 128 characters.');
  }

  const passwordHash = await bcrypt.hash(password, bcryptCostFactor);

  const importedCount = await prisma.$transaction(async (tx) => {
    const user = await tx.adminUser.upsert({
      where: { username },
      update: { passwordHash, permissions: ['BUDGET'] },
      create: {
        username,
        passwordHash,
        permissions: ['BUDGET'],
      },
      select: { id: true },
    });

    const budget = await tx.budget.findFirst({
      where: { name: budgetName, ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    const targetBudget = budget ?? await tx.budget.create({ data: { name: budgetName, ownerId: user.id } });
    const existingItems = await tx.budgetItem.findMany({
      where: { budgetId: targetBudget.id },
      select: { value: true, itemDate: true, description: true, additionalInfo: true, isPaid: true },
    });
    const existingKeys = new Set(existingItems.map(itemKey));
    const newItems = budgetItems.filter((item) => {
      const key = itemKey({
        value: item.value,
        itemDate: item.date,
        description: item.description,
        additionalInfo: item.additionalInfo,
        isPaid: true,
      });
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (newItems.length > 0) {
      await tx.budgetItem.createMany({
        data: newItems.map((item) => ({
          budgetId: targetBudget.id,
          value: item.value,
          itemDate: new Date(`${item.date}T00:00:00.000Z`),
          description: item.description,
          additionalInfo: item.additionalInfo,
          isPaid: true,
        })),
      });
    }
    return newItems.length;
  });

  console.log(`Ensured user "pedro" and budget "Casa Boa Vista"; added ${importedCount} new paid items.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
