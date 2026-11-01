import { pgTable, text, serial, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  nama: text('nama'),
  role: text('role').default('member'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const memberAccounts = pgTable('member_accounts', {
  id: serial('id').primaryKey(),
  memberId: text('member_id').notNull().unique(),
  nomorAnggota: text('nomor_anggota').notNull(),
  nomorRekening: text('nomor_rekening').notNull().unique(),
  nama: text('nama').notNull(),
  wilayah: text('wilayah').notNull(),
  saldoPokok: integer('saldo_pokok').default(0).notNull(),
  saldoUmum: integer('saldo_umum').default(0).notNull(),
  saldoZakat: integer('saldo_zakat').default(0).notNull(),
  saldoQurban: integer('saldo_qurban').default(0).notNull(),
  totalSimpanan: integer('total_simpanan').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const kasEntries = pgTable('kas_entries', {
  id: serial('id').primaryKey(),
  kasId: text('kas_id').notNull().unique(),
  bukuKas: text('buku_kas').notNull(), // 'anggota' | 'koperasi'
  tanggal: text('tanggal').notNull(),
  kategori: text('kategori').notNull(),
  keterangan: text('keterangan').notNull(),
  namaPenerima: text('nama_penerima'),
  memberId: text('member_id'),
  tipe: text('tipe').notNull(), // 'masuk' | 'keluar'
  nominal: integer('nominal').notNull(),
  saldoSetelah: integer('saldo_setelah').default(0).notNull(),
  inputBy: text('input_by').notNull(),
  status: text('status').default('approved').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  messageId: text('message_id').notNull().unique(),
  memberId: text('member_id').notNull(),
  senderType: text('sender_type').notNull(), // 'member' | 'admin'
  senderNama: text('sender_nama').notNull(),
  pesan: text('pesan').notNull(),
  lampiranUrl: text('lampiran_url'),
  isReadByAdmin: boolean('is_read_by_admin').default(false).notNull(),
  isReadByMember: boolean('is_read_by_member').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
