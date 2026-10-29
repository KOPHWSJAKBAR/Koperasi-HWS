import { MemberUser, MemberTransaction, KategoriTabunganMutasi, KasEntry, SedekahBerbagiEntry } from '../types';
import { formatRupiah } from './storage';

// Helper to open a clean print window with accurate styling and triggers browser PDF printing
export function printDocumentHtml(htmlContent: string, title: string = 'Dokumen Koperasi HWS') {
  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (!printWindow) {
    alert('Pop-up terblokir. Izinkan pop-up peramban untuk mencetak atau mengunduh PDF.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
        }
        body {
          background-color: #ffffff;
          color: #0f172a;
          padding: 24px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 12mm 10mm;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
        .watermark-container {
          position: relative;
          width: 100%;
          min-height: 100%;
        }
        .watermark-bg {
          position: absolute;
          top: 42%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.085;
          width: 480px;
          height: 480px;
          pointer-events: none;
          z-index: 0;
        }
        .watermark-security-stamp {
          position: absolute;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          border: 3px dashed rgba(217, 119, 6, 0.16);
          padding: 16px 36px;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 4px;
          color: rgba(180, 83, 9, 0.14);
          text-transform: uppercase;
          pointer-events: none;
          z-index: 1;
          white-space: nowrap;
        }
        .content-layer {
          position: relative;
          z-index: 10;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; padding: 12px 18px; background: #0f172a; color: #fff; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🛡️</span>
          <span style="font-weight: 700; font-size: 14px;">Pratinjau Resmi Koperasi HWS (Watermark Anti-Pemalsuan Aktif)</span>
        </div>
        <button onclick="window.print()" style="background: #f59e0b; color: #020617; font-weight: 800; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
          🖨️ Cetak / Simpan PDF
        </button>
      </div>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Generate exact BCA Rekening Tahapan style for member mutasi with REAL Saldo Awal from prior days
export function generateMutasiRekeningPdf(
  member: MemberUser,
  transactions: MemberTransaction[],
  options: {
    kategori: KategoriTabunganMutasi;
    periodeLabel: string;
    startDate?: string;
    endDate?: string;
  }
) {
  // 1. Calculate REAL Saldo Awal from days strictly before options.startDate
  let saldoAwal = 0;
  if (options.startDate) {
    const priorTransactions = transactions
      .filter((t) => t.memberId === member.id)
      .filter((t) => options.kategori === 'semua' || t.kategori === options.kategori)
      .filter((t) => t.tanggal < options.startDate!);

    priorTransactions.forEach((t) => {
      saldoAwal += t.tipe === 'masuk' ? t.nominal : -t.nominal;
    });
  }

  // 2. Filter transactions in the current period
  let filtered = [...transactions].filter((t) => t.memberId === member.id);

  if (options.kategori !== 'semua') {
    filtered = filtered.filter((t) => t.kategori === options.kategori);
  }

  if (options.startDate) {
    filtered = filtered.filter((t) => t.tanggal >= options.startDate!);
  }
  if (options.endDate) {
    filtered = filtered.filter((t) => t.tanggal <= options.endDate!);
  }

  // Sort chronological: requirement "urutannya dari awal ada di atas serta selanjutnya ke bawah"
  filtered.sort((a, b) => {
    const da = `${a.tanggal} ${a.jam || '00:00'}`;
    const db = `${b.tanggal} ${b.jam || '00:00'}`;
    return da.localeCompare(db);
  });

  // Calculate totals in the period
  let totalMasuk = 0;
  let totalKeluar = 0;
  let countMasuk = 0;
  let countKeluar = 0;

  filtered.forEach((t) => {
    if (t.tipe === 'masuk') {
      totalMasuk += t.nominal;
      countMasuk++;
    } else {
      totalKeluar += t.nominal;
      countKeluar++;
    }
  });

  const saldoAkhir = saldoAwal + totalMasuk - totalKeluar;

  let kategoriTitle = 'SEMUA TABUNGAN';
  if (options.kategori === 'pokok') kategoriTitle = 'TABUNGAN POKOK / WAJIB';
  if (options.kategori === 'umum') kategoriTitle = 'TABUNGAN UMUM BEBAS';
  if (options.kategori === 'zakat') kategoriTitle = 'SIMPANAN ZAKAT FITRAH';
  if (options.kategori === 'qurban') kategoriTitle = 'TABUNGAN QURBAN';

  // First row: SALDO AWAL (dari hari sebelumnya)
  const saldoAwalRow = `
    <tr style="border-bottom: 1px dashed #cbd5e1; font-size: 11px; background-color: #f8fafc;">
      <td style="padding: 6px 8px; vertical-align: top; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #64748b;">-</td>
      <td style="padding: 6px 8px; vertical-align: top; font-weight: 800; color: #1e293b; text-transform: uppercase;">
        SALDO AWAL (DARI HARI SEBELUMNYA)
      </td>
      <td style="padding: 6px 8px; vertical-align: top; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748b;">0001</td>
      <td style="padding: 6px 8px; vertical-align: top; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #64748b;">-</td>
      <td style="padding: 6px 8px; vertical-align: top; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #0f172a;">
        ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAwal)}
      </td>
    </tr>
  `;

  const rowsHtml = filtered.length === 0
    ? `
      ${saldoAwalRow}
      <tr><td colspan="5" style="text-align: center; padding: 20px; color: #64748b; font-size: 12px; font-style: italic;">Tidak ada transaksi tambahan pada periode ini.</td></tr>
    `
    : [
        saldoAwalRow,
        ...filtered.map((tx) => {
          const formattedTgl = tx.tanggal.split('-').reverse().slice(0, 2).join('/');
          const isMasuk = tx.tipe === 'masuk';
          const mutasiStr = `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.nominal)} ${isMasuk ? 'CR' : 'DB'}`;
          const saldoStr = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.saldoSetelah);

          return `
            <tr style="border-bottom: 1px dashed #e2e8f0; font-size: 11px;">
              <td style="padding: 6px 8px; vertical-align: top; font-family: 'JetBrains Mono', monospace;">${formattedTgl}</td>
              <td style="padding: 6px 8px; vertical-align: top; text-transform: uppercase;">
                <div style="font-weight: 600;">${tx.keterangan}</div>
              </td>
              <td style="padding: 6px 8px; vertical-align: top; font-family: 'JetBrains Mono', monospace; font-size: 10px;">${tx.cbg || '0001'}</td>
              <td style="padding: 6px 8px; vertical-align: top; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: ${isMasuk ? '#047857' : '#b91c1c'};">
                ${mutasiStr}
              </td>
              <td style="padding: 6px 8px; vertical-align: top; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700;">
                ${saldoStr}
              </td>
            </tr>
          `;
        }),
      ].join('');

  const html = `
    <div class="watermark-container">
      <!-- Watermark Logo Anti Pemalsuan -->
      <svg class="watermark-bg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000000" stroke-width="2" />
        <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
        <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
        <polygon points="100,54 124,68 124,106 100,120 76,106 76,68" fill="#007ACC" />
      </svg>
      <div class="watermark-security-stamp">
        DOKUMEN RESMI KOPERASI HWS • ASLI
      </div>

      <div class="content-layer">
        <!-- Top Header: Logo HWS & Title -->
        <table style="width: 100%; margin-bottom: 12px; border-collapse: collapse;">
          <tr>
            <td style="width: 28%; vertical-align: middle;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="44" height="44" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000000" stroke-width="2" />
                  <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
                  <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
                  <polygon points="100,54 124,68 124,106 100,120 76,106 76,68" fill="#007ACC" />
                </svg>
                <div>
                  <div style="font-weight: 900; font-size: 15px; color: #0f172a; letter-spacing: 0.5px;">KOPERASI HWS</div>
                  <div style="font-size: 9px; color: #475569; font-weight: 700; text-transform: uppercase;">KCP ${member.wilayah.toUpperCase()}</div>
                </div>
              </div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; margin: 0; text-transform: uppercase;">
                REKENING TAHAPAN
              </h1>
              <div style="font-size: 11px; font-weight: 700; color: #d97706; margin-top: 2px;">
                ${kategoriTitle}
              </div>
            </td>
            <td style="width: 28%; text-align: right; vertical-align: middle;">
              <span style="font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace;">AHU-0004921.AH.01.29</span>
            </td>
          </tr>
        </table>

        <!-- Two Box Layout: Left (Member Info), Right (Account Info) -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 12px;">
          <tr>
            <!-- Left Box: Member Info -->
            <td style="width: 52%; border: 1.5px solid #0f172a; border-radius: 6px; padding: 10px 12px; vertical-align: top; font-size: 11px; line-height: 1.45;">
              <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; color: #0f172a;">${member.nama}</div>
              <div style="font-weight: 700; color: #334155;">KEC ${member.kecamatan ? member.kecamatan.toUpperCase() : member.wilayah.toUpperCase()}</div>
              <div>RT ${member.rt || '001'} RW ${member.rw || '001'} ${member.kelurahan ? 'KEL ' + member.kelurahan.toUpperCase() : ''}</div>
              <div>${member.alamatLengkap ? member.alamatLengkap.toUpperCase() : 'DKI JAKARTA'}</div>
              <div>${member.kota ? member.kota.toUpperCase() : 'JAKARTA BARAT'} ${member.kodePos || '11740'}</div>
              <div style="font-weight: 700;">INDONESIA</div>
            </td>

            <!-- Right Box: Account Meta -->
            <td style="width: 48%; border: 1.5px solid #0f172a; border-radius: 6px; padding: 10px 12px; vertical-align: top; font-size: 11px; line-height: 1.5;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 38%; font-weight: 700;">NO. REKENING</td>
                  <td style="width: 5%;">:</td>
                  <td style="font-weight: 800; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #0f172a;">${member.nomorRekening}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">NO. ANGGOTA</td>
                  <td>:</td>
                  <td style="font-weight: 700; font-family: 'JetBrains Mono', monospace;">${member.nomorAnggota}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">PERIODE</td>
                  <td>:</td>
                  <td style="font-weight: 700; text-transform: uppercase;">${options.periodeLabel}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">MATA UANG</td>
                  <td>:</td>
                  <td style="font-weight: 700;">IDR (RUPIAH)</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Catatan Box (Disclaimer) -->
        <div style="border: 1.5px solid #0f172a; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; font-size: 9px; line-height: 1.35; color: #1e293b;">
          <div style="font-weight: 800; margin-bottom: 2px;">CATATAN :</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; padding-right: 8px; vertical-align: top;">
                • Apabila anggota tidak melakukan sanggahan atas Laporan Mutasi Rekening ini sampai dengan akhir bulan berjalan, anggota dianggap telah menyetujui mutasi tersebut.
              </td>
              <td style="width: 50%; padding-left: 8px; vertical-align: top;">
                • Koperasi HWS berhak setiap saat melakukan koreksi pembukuan apabila terdapat kesalahan pencatatan teknis.
              </td>
            </tr>
          </table>
        </div>

        <!-- Table of Transactions -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1.5px solid #0f172a;">
          <thead>
            <tr style="border-bottom: 1.5px solid #0f172a; background-color: #f1f5f9; font-size: 10px; font-weight: 800; text-transform: uppercase;">
              <th style="padding: 6px 8px; text-align: left; width: 10%;">TANGGAL</th>
              <th style="padding: 6px 8px; text-align: left; width: 45%;">KETERANGAN</th>
              <th style="padding: 6px 8px; text-align: left; width: 8%;">CBG</th>
              <th style="padding: 6px 8px; text-align: right; width: 18%;">MUTASI</th>
              <th style="padding: 6px 8px; text-align: right; width: 19%;">SALDO</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Summary Box at Bottom (Req 9: Terdapat saldo awal dari hari sebelumnya, saldo awal dan jumlah kredit dan debit serta saldo) -->
        <div style="display: flex; justify-content: flex-end;">
          <table style="width: 55%; border-collapse: collapse; font-size: 11px; font-family: 'JetBrains Mono', monospace; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden;">
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 5px 8px; font-weight: 700; color: #1e293b;">SALDO AWAL (HARI SEBELUMNYA)</td>
              <td style="width: 4%;">:</td>
              <td style="padding: 5px 8px; text-align: right; font-weight: 700;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAwal)}</td>
              <td style="width: 10%;"></td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 5px 8px; font-weight: 700; color: #047857;">MUTASI CR (KREDIT / MASUK)</td>
              <td>:</td>
              <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #047857;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalMasuk)}</td>
              <td style="padding: 5px 8px; text-align: right; color: #64748b; font-size: 10px;">${countMasuk} trx</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 5px 8px; font-weight: 700; color: #b91c1c;">MUTASI DB (DEBIT / KELUAR)</td>
              <td>:</td>
              <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: #b91c1c;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalKeluar)}</td>
              <td style="padding: 5px 8px; text-align: right; color: #64748b; font-size: 10px;">${countKeluar} trx</td>
            </tr>
            <tr style="background: #0f172a; color: #ffffff;">
              <td style="padding: 6px 8px; font-weight: 900; font-size: 12px;">SALDO AKHIR</td>
              <td>:</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 900; font-size: 13px; color: #fbbf24;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAkhir)}</td>
              <td></td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 24px; font-size: 9px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          Dokumen ini diterbitkan secara sah dan otomatis oleh Sistem Elektronik Koperasi Himpunan Wirausaha Sejahtera (Koperasi HWS). Watermark logo tertanam untuk menjamin keaslian data.
        </div>
      </div>
    </div>
  `;

  printDocumentHtml(html, `Mutasi_Rekening_${member.nomorRekening}_${options.periodeLabel.replace(/\s+/g, '_')}`);
}

// User Req 12 & 13: Export Excel Anggota dengan Judul di Atas, Periode, Kolom Sesuai Permintaan, dan Baris Total Keseluruhan di Bawah
export function exportAnggotaExcel(
  members: MemberUser[],
  periodeLabel: string = 'Semua Periode',
  judulLaporan: string = 'LAPORAN REKAPITULASI TABUNGAN ANGGOTA'
) {
  let totalPokok = 0;
  let totalQurban = 0;
  let totalZakat = 0;
  let totalKeseluruhan = 0;

  // Build CSV rows
  const csvLines: string[] = [];

  // 1. Judul & Header Laporan di bagian atas (Req 13)
  csvLines.push(`"KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA (KOPERASI HWS)"`);
  csvLines.push(`"${judulLaporan.toUpperCase()}"`);
  csvLines.push(`"PERIODE LAPORAN: ${periodeLabel.toUpperCase()}"`);
  csvLines.push(`"TANGGAL CETAK: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}"`);
  csvLines.push(``); // Empty row separator

  // 2. Kolom Header persis sesuai User Req 13:
  // "kolom nama, wilayah, Tabungan pokok, Tabungan qurban, Tabungan zakat, dan jumlah tampilkan periode serta judul pada diatas"
  csvLines.push(`"No","Nama Anggota","Nomor Rekening","Wilayah","Tabungan Pokok","Tabungan Qurban","Tabungan Zakat","Jumlah"`);

  // 3. Data baris anggota
  members.forEach((m, idx) => {
    const pokok = m.saldoPokok || 0;
    const qurban = m.saldoQurban || 0;
    const zakat = m.saldoZakatFitrah || 0;
    const jumlah = pokok + qurban + zakat + (m.saldoUmum || 0);

    totalPokok += pokok;
    totalQurban += qurban;
    totalZakat += zakat;
    totalKeseluruhan += jumlah;

    csvLines.push(
      `"${idx + 1}","${m.nama.replace(/"/g, '""')}","${m.nomorRekening}","${m.wilayah}","${pokok}","${qurban}","${zakat}","${jumlah}"`
    );
  });

  // 4. Baris TOTAL KESELURUHAN ke bawah (Req 12)
  csvLines.push(``);
  csvLines.push(
    `"TOTAL KESELURUHAN","Total Anggota: ${members.length}","","","${totalPokok}","${totalQurban}","${totalZakat}","${totalKeseluruhan}"`
  );

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Laporan_Tabungan_Anggota_HWS_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// User Req 12: Export PDF Anggota dengan Baris Total Keseluruhan di Bawah dan Watermark Anti-Pemalsuan
export function exportAnggotaPdf(
  members: MemberUser[],
  periodeLabel: string = 'Semua Periode',
  wilayahLabel: string = 'Semua Wilayah'
) {
  let totalPokok = 0;
  let totalQurban = 0;
  let totalZakat = 0;
  let totalKeseluruhan = 0;

  const tableRows = members
    .map((m, idx) => {
      const pokok = m.saldoPokok || 0;
      const qurban = m.saldoQurban || 0;
      const zakat = m.saldoZakatFitrah || 0;
      const jumlah = pokok + qurban + zakat + (m.saldoUmum || 0);

      totalPokok += pokok;
      totalQurban += qurban;
      totalZakat += zakat;
      totalKeseluruhan += jumlah;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 6px; font-weight: 700; color: #0f172a;">${m.nama}</td>
          <td style="padding: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10px;">${m.nomorRekening}</td>
          <td style="padding: 6px;">${m.wilayah}</td>
          <td style="padding: 6px; text-align: right; font-family: 'JetBrains Mono', monospace;">${formatRupiah(pokok)}</td>
          <td style="padding: 6px; text-align: right; font-family: 'JetBrains Mono', monospace;">${formatRupiah(qurban)}</td>
          <td style="padding: 6px; text-align: right; font-family: 'JetBrains Mono', monospace;">${formatRupiah(zakat)}</td>
          <td style="padding: 6px; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #0f172a;">
            ${formatRupiah(jumlah)}
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div class="watermark-container">
      <!-- Watermark Logo -->
      <svg class="watermark-bg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000000" stroke-width="2" />
        <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
        <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
        <polygon points="100,54 124,68 124,106 100,120 76,106 76,68" fill="#007ACC" />
      </svg>
      <div class="watermark-security-stamp">
        DOKUMEN RESMI KOPERASI HWS • ASLI
      </div>

      <div class="content-layer">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
          <h2 style="font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA (KOPERASI HWS)</h2>
          <div style="font-size: 13px; font-weight: 800; color: #d97706; margin-top: 2px;">
            LAPORAN REKAPITULASI TABUNGAN ANGGOTA (${wilayahLabel.toUpperCase()})
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            Periode: <b>${periodeLabel.toUpperCase()}</b> • Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a;">
          <thead>
            <tr style="background: #f1f5f9; font-size: 10px; text-transform: uppercase; font-weight: 800; border-bottom: 1.5px solid #0f172a;">
              <th style="padding: 7px 5px; width: 4%; text-align: center;">NO</th>
              <th style="padding: 7px 6px; text-align: left;">NAMA ANGGOTA</th>
              <th style="padding: 7px 6px; text-align: left; width: 14%;">NO. REKENING</th>
              <th style="padding: 7px 6px; text-align: left; width: 12%;">WILAYAH</th>
              <th style="padding: 7px 6px; text-align: right; width: 13%;">TAB. POKOK</th>
              <th style="padding: 7px 6px; text-align: right; width: 13%;">TAB. QURBAN</th>
              <th style="padding: 7px 6px; text-align: right; width: 13%;">TAB. ZAKAT</th>
              <th style="padding: 7px 6px; text-align: right; width: 16%;">JUMLAH TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <!-- Baris Total Keseluruhan ke bawah (Req 12) -->
            <tr style="background: #0f172a; color: #ffffff; font-weight: 900; font-size: 11px; border-top: 2px solid #0f172a;">
              <td colspan="4" style="padding: 8px 10px; text-align: left;">
                TOTAL KESELURUHAN (${members.length} ANGGOTA)
              </td>
              <td style="padding: 8px 6px; text-align: right; font-family: 'JetBrains Mono', monospace;">
                ${formatRupiah(totalPokok)}
              </td>
              <td style="padding: 8px 6px; text-align: right; font-family: 'JetBrains Mono', monospace;">
                ${formatRupiah(totalQurban)}
              </td>
              <td style="padding: 8px 6px; text-align: right; font-family: 'JetBrains Mono', monospace;">
                ${formatRupiah(totalZakat)}
              </td>
              <td style="padding: 8px 6px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #fbbf24;">
                ${formatRupiah(totalKeseluruhan)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 24px; font-size: 9px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          Dokumen ini diterbitkan secara sah dan otomatis oleh Sistem Elektronik Koperasi Himpunan Wirausaha Sejahtera (Koperasi HWS). Watermark logo tertanam untuk menjamin keaslian data.
        </div>
      </div>
    </div>
  `;

  printDocumentHtml(html, `Rekap_Tabungan_Anggota_${wilayahLabel}`);
}

// Helper: Generic Download Array of Objects as CSV
export function downloadExcelCsv(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diunduh.');
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((fieldName) => {
        const val = row[fieldName] ?? '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper: Konversi Nominal ke Terbilang Bahasa Indonesia
export function angkaTerbilang(n: number): string {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const bulat = Math.floor(Math.abs(n));
  if (bulat < 12) return bilangan[bulat];
  if (bulat < 20) return angkaTerbilang(bulat - 10) + ' Belas';
  if (bulat < 100) return angkaTerbilang(Math.floor(bulat / 10)) + ' Puluh' + (bulat % 10 !== 0 ? ' ' + angkaTerbilang(bulat % 10) : '');
  if (bulat < 200) return 'Seratus' + (bulat % 100 !== 0 ? ' ' + angkaTerbilang(bulat % 100) : '');
  if (bulat < 1000) return angkaTerbilang(Math.floor(bulat / 100)) + ' Ratus' + (bulat % 100 !== 0 ? ' ' + angkaTerbilang(bulat % 100) : '');
  if (bulat < 2000) return 'Seribu' + (bulat % 1000 !== 0 ? ' ' + angkaTerbilang(bulat % 1000) : '');
  if (bulat < 1000000) return angkaTerbilang(Math.floor(bulat / 1000)) + ' Ribu' + (bulat % 1000 !== 0 ? ' ' + angkaTerbilang(bulat % 1000) : '');
  if (bulat < 1000000000) return angkaTerbilang(Math.floor(bulat / 1000000)) + ' Juta' + (bulat % 1000000 !== 0 ? ' ' + angkaTerbilang(bulat % 1000000) : '');
  if (bulat < 1000000000000) return angkaTerbilang(Math.floor(bulat / 1000000000)) + ' Miliar' + (bulat % 1000000000 !== 0 ? ' ' + angkaTerbilang(bulat % 1000000000) : '');
  return `${bulat}`;
}

// Helper: Cetak Tanda Terima / Kuitansi Kas Koperasi Resmi (Req 1 & Req 15)
export function printTandaTerimaKas(entry: KasEntry, profile: any) {
  const isMasuk = entry.tipe === 'masuk';
  const noKuitansi = `HWS/${isMasuk ? 'BKM' : 'BKK'}/${entry.tanggal.replace(/-/g, '')}/${entry.id.replace(/\D/g, '').slice(-4) || '001'}`;
  const terbilangStr = `${angkaTerbilang(entry.nominal)} Rupiah`;
  const namaPihak = entry.namaPenerima || (isMasuk ? 'Penyetor / Anggota' : 'Penerima Kas');

  const html = `
    <div class="watermark-container" style="position: relative; min-height: 100%;">
      <!-- Repeating Watermark Grid Pattern (Req 1) -->
      <div style="position: absolute; inset: 0; pointer-events: none; opacity: 0.08; display: grid; grid-template-columns: repeat(3, 1fr); gap: 80px 40px; align-items: center; justify-items: center; z-index: 1; overflow: hidden;">
        ${Array.from({ length: 15 })
          .map(
            () => `
          <div style="text-align: center; font-weight: 900; font-size: 15px; transform: rotate(-25deg); color: #000; letter-spacing: 2px;">
            KOPERASI HWS • RESMI & SAH
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Watermark Logo Besar di Tengah -->
      <svg class="watermark-bg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%); opacity: 0.12; width: 380px; height: 380px; pointer-events: none; z-index: 2;">
        <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000000" stroke-width="2" />
        <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
        <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
        <polygon points="100,54 124,68 124,106 100,120 76,106 76,68" fill="#007ACC" />
      </svg>
      <div class="watermark-security-stamp" style="position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); border: 3px dashed rgba(180, 83, 9, 0.28); padding: 12px 30px; border-radius: 12px; font-size: 18px; font-weight: 900; letter-spacing: 3px; color: rgba(180, 83, 9, 0.25); text-transform: uppercase; pointer-events: none; z-index: 3; white-space: nowrap;">
        WATERMARK RESMI KOPERASI HWS • DIVERIFIKASI SAH
      </div>

      <div class="content-layer" style="position: relative; z-index: 10;">
        <!-- Header Kuitansi -->
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 style="font-size: 16px; font-weight: 900; color: #0f172a; margin: 0;">
              ${profile?.nama || 'KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA (KOPERASI HWS)'}
            </h2>
            <div style="font-size: 11px; color: #475569; margin-top: 3px;">
              Badan Hukum: ${profile?.badanHukum || 'AHU-0004921.AH.01.29.TAHUN 2024'} • NPWP: ${profile?.npwpKoperasi || '82.910.293.4-038.000'}
            </div>
            <div style="font-size: 10px; color: #64748b;">
              ${profile?.alamat || 'Jl. Raya Daan Mogot KM 11 No. 8, Cengkareng, Jakarta Barat'} • Telp: ${profile?.telepon || '0858-1755-4296'}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 900; color: ${isMasuk ? '#047857' : '#b91c1c'}; border: 1.5px solid ${isMasuk ? '#047857' : '#b91c1c'}; padding: 4px 10px; border-radius: 6px; display: inline-block;">
              ${isMasuk ? 'BUKTI KAS MASUK (BKM)' : 'BUKTI KAS KELUAR (BKK)'}
            </div>
            <div style="font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #475569; margin-top: 4px;">
              No: ${noKuitansi}
            </div>
          </div>
        </div>

        <!-- Detail Kuitansi -->
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
              <tr>
                <td style="padding: 6px 0; width: 24%; color: #475569; font-weight: 600;">
                  ${isMasuk ? 'Telah Diterima Dari' : 'Telah Diserahkan Kepada'}
                </td>
                <td style="padding: 6px 8px; width: 2%; font-weight: 700;">:</td>
                <td style="padding: 6px 0; font-weight: 800; color: #0f172a; font-size: 13px;">
                  ${namaPihak}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569; font-weight: 600;">Tanggal Transaksi</td>
                <td style="padding: 6px 8px; font-weight: 700;">:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">
                  ${new Date(entry.tanggal).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569; font-weight: 600;">Kategori Buku Kas</td>
                <td style="padding: 6px 8px; font-weight: 700;">:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0284c7;">
                  ${entry.kategori} (${entry.bukuKas === 'koperasi' ? 'Kas Koperasi' : 'Kas Anggota'})
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569; font-weight: 600; vertical-align: top;">Untuk Keperluan</td>
                <td style="padding: 6px 8px; font-weight: 700; vertical-align: top;">:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #1e293b; line-height: 1.5;">
                  ${entry.keterangan}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #475569; font-weight: 600;">Terbilang</td>
                <td style="padding: 6px 8px; font-weight: 700;">:</td>
                <td style="padding: 6px 0; font-style: italic; font-weight: 700; color: #334155; background: #e2e8f0; padding-left: 8px; border-radius: 4px;">
                  # ${terbilangStr} #
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Kotak Jumlah Nominal Uang -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 10px; margin-bottom: 25px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            JUMLAH PEMBAYARAN:
          </div>
          <div style="font-size: 20px; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #38bdf8;">
            ${formatRupiah(entry.nominal)}
          </div>
        </div>

        <!-- Kolom Pengesahan Tanda Tangan -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; margin-top: 30px;">
          <div>
            <div style="color: #64748b; margin-bottom: 50px;">
              ${isMasuk ? 'Yang Menyetor,' : 'Yang Menerima,'}
            </div>
            <div style="font-weight: 800; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
              ( ${namaPihak} )
            </div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 50px;">
              Petugas Kasir / Input,
            </div>
            <div style="font-weight: 800; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
              ( ${entry.inputBy || 'Petugas Koperasi'} )
            </div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 50px;">
              Disetujui / Bendahara,
            </div>
            <div style="font-weight: 800; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 140px; padding-bottom: 2px;">
              ( ${entry.approvedBy || profile?.bendahara || 'Suryadi Pratama'} )
            </div>
          </div>
        </div>

        <div style="margin-top: 35px; text-align: center; font-size: 9px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          Tanda terima pembayaran ini sah dan mengikat. Dicetak secara realtime dari Sistem Manajemen Koperasi HWS.
        </div>
      </div>
    </div>
  `;

  printDocumentHtml(html, `Tanda_Terima_${isMasuk ? 'Masuk' : 'Keluar'}_${noKuitansi.replace(/\//g, '_')}`);
}

// Helper: Download HTML table content as Native Excel (.xls) file
export function downloadExcelHtml(htmlContent: string, filename: string) {
  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Laporan Buku Kas</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      <style>
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 25px; }
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 8px; border: 1px solid #000; text-align: left; }
        td { padding: 6px 8px; border: 1px solid #ddd; }
        .num { text-align: right; font-family: monospace; }
        .center { text-align: center; }
        .header-title { font-size: 16pt; font-weight: bold; color: #0f172a; }
        .sub-title { font-size: 11pt; font-weight: bold; color: #b45309; }
        .section-header { background-color: #f1f5f9; font-weight: bold; font-size: 11pt; }
        .total-row { background-color: #0f172a; color: #fbbf24; font-weight: bold; font-size: 11pt; }
        .cat-title { background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11pt; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;
  const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface BukuKasExportPayload {
  bukuKasType: 'anggota' | 'koperasi' | 'neraca';
  kasEntries: KasEntry[];
  periodeLabel: string;
  allMembers?: MemberUser[];
  categoriesKoperasi?: { pemasukan: string[]; pengeluaran: string[] };
  saldoKasAnggota?: number;
  saldoKasKoperasi?: number;
  saldoSedekahKoperasi?: number;
  saldoKasBerjalan?: number;
}

// User Req 1: Buku kas anggota, koperasi / konsolidasi download PDF
// - Jurnal pada halaman depan:
//   PEMASUKAN = TAMPILKAN SEMUA KATEGORI, JUMLAH
//   PENGELUARAN = TAMPILKAN SEMUA KATEGORI, JUMLAH
//   TOTAL = PEMASUKAN - PENGELUARAN
// - Pada halaman selanjutnya adalah perincian kategori dengan judul kategori tampilkan tanggal, keterangan, serta jumlah
// - Pada buku kas 3 neraca dan konsolidasi:
//   Tampilkan semua kategori pada pendapatan dan penerimaan, jumlah sesuai kategori
// Helper untuk mengelompokkan kategori sesuai spesifikasi User Req 1:
// - Buku kas anggota, buku kas koperasi dan konsolidasi
// - Jurnal pada halaman depan:
//   PEMASUKAN = TAMPILKAN SEMUA KATEGORI, JUMLAH
//   PENGELUARAN = TAMPILKAN SEMUA KATEGORI, JUMLAH
//   TOTAL = PEMASUKAN - PENGELUARAN
// - Pada halaman selanjutnya adalah perincian kategori dengan judul kategori tampilkan tanggal, keterangan, serta jumlah
// - Pada buku kas 3 neraca dan konsolidasi:
//   Tampilkan semua kategori pada pendapatan dan penerimaan, jumlah sesuai kategori
//   Tampilkan semua kategori pada beban dan pengeluaran overhead, jumlah sesuai kategori
export function getBukuKasCategoryMaps(
  bukuKasType: 'anggota' | 'koperasi' | 'neraca',
  kasEntries: KasEntry[],
  categoriesKoperasi?: { pemasukan: string[]; pengeluaran: string[] }
) {
  const catMasukMap = new Map<string, { total: number; entries: KasEntry[] }>();
  const catKeluarMap = new Map<string, { total: number; entries: KasEntry[] }>();

  if (bukuKasType === 'anggota') {
    const defaultAnggotaMasuk = [
      'Simpanan Pokok Anggota',
      'Simpanan Wajib Anggota',
      'Simpanan Sukarela Anggota',
      'Simpanan Umum Anggota',
      'Titipan Zakat Fitrah',
      'Tabungan Qurban',
      'Pemasukan Kas Anggota Lainnya',
    ];
    const defaultAnggotaKeluar = [
      'Penarikan Simpanan Pokok',
      'Penarikan Simpanan Wajib',
      'Penarikan Simpanan Sukarela / Umum',
      'Penyaluran Zakat Fitrah',
      'Penyaluran Qurban',
      'Pengembalian Simpanan',
      'Pengeluaran Kas Anggota Lainnya',
    ];
    defaultAnggotaMasuk.forEach((c) => catMasukMap.set(c, { total: 0, entries: [] }));
    defaultAnggotaKeluar.forEach((c) => catKeluarMap.set(c, { total: 0, entries: [] }));
  } else if (bukuKasType === 'neraca') {
    // Pada buku kas 3 neraca dan konsolidasi:
    // Tampilkan semua kategori pada pendapatan dan penerimaan
    const standardPendapatan = [
      ...(categoriesKoperasi?.pemasukan || []),
      'Pendapatan Operasional Koperasi',
      'Pendapatan Jasa & Administrasi',
      'Pendapatan Bagi Hasil Simpan Pinjam',
      'Penerimaan Infaq & Sumbangan',
      'Penerimaan Operasional Lainnya',
    ];
    // Tampilkan semua kategori pada beban dan pengeluaran overhead
    const standardBeban = [
      ...(categoriesKoperasi?.pengeluaran || []),
      'Beban Operasional & Kantor',
      'Beban ATK, Dokumen & Cetak',
      'Beban Listrik, Air & Internet',
      'Beban Transportasi & Bahan Bakar',
      'Beban Konsumsi & Rapat Pengurus',
      'Beban Gaji & Honor Pengurus',
      'Beban Pemeliharaan Fasilitas',
      'Beban Pengeluaran Overhead Lainnya',
    ];
    Array.from(new Set(standardPendapatan)).forEach((c) => catMasukMap.set(c, { total: 0, entries: [] }));
    Array.from(new Set(standardBeban)).forEach((c) => catKeluarMap.set(c, { total: 0, entries: [] }));
  } else {
    // Buku Kas Koperasi
    if (categoriesKoperasi?.pemasukan) {
      categoriesKoperasi.pemasukan.forEach((c) => catMasukMap.set(c, { total: 0, entries: [] }));
    }
    if (categoriesKoperasi?.pengeluaran) {
      categoriesKoperasi.pengeluaran.forEach((c) => catKeluarMap.set(c, { total: 0, entries: [] }));
    }
  }

  // Masukkan kas entries ke kategori masing-masing
  kasEntries.forEach((k) => {
    if (k.tipe === 'masuk') {
      const cat = k.kategori || (bukuKasType === 'neraca' ? 'Penerimaan Operasional Lainnya' : 'Pemasukan Lainnya');
      const curr = catMasukMap.get(cat) || { total: 0, entries: [] };
      curr.total += k.nominal;
      curr.entries.push(k);
      catMasukMap.set(cat, curr);
    } else if (k.tipe === 'keluar') {
      const cat = k.kategori || (bukuKasType === 'neraca' ? 'Beban Pengeluaran Overhead Lainnya' : 'Pengeluaran Lainnya');
      const curr = catKeluarMap.get(cat) || { total: 0, entries: [] };
      curr.total += k.nominal;
      curr.entries.push(k);
      catKeluarMap.set(cat, curr);
    }
  });

  return { catMasukMap, catKeluarMap };
}

export function exportBukuKasPdf(payload: BukuKasExportPayload) {
  const {
    bukuKasType,
    kasEntries,
    periodeLabel,
    allMembers = [],
    categoriesKoperasi,
    saldoKasAnggota = 0,
    saldoKasKoperasi = 0,
    saldoSedekahKoperasi = 0,
    saldoKasBerjalan,
  } = payload;

  const titleBuku =
    bukuKasType === 'anggota'
      ? 'BUKU KAS 1: REKAPITULASI KAS ANGGOTA'
      : bukuKasType === 'koperasi'
      ? 'BUKU KAS 2: OPERASIONAL KAS KOPERASI'
      : 'BUKU KAS 3: NERACA & KONSOLIDASI KEUANGAN';

  const { catMasukMap, catKeluarMap } = getBukuKasCategoryMaps(
    bukuKasType,
    kasEntries,
    categoriesKoperasi
  );

  const totalMasuk = Array.from(catMasukMap.values()).reduce((sum, item) => sum + item.total, 0);
  const totalKeluar = Array.from(catKeluarMap.values()).reduce((sum, item) => sum + item.total, 0);
  const totalSaldoBersih = totalMasuk - totalKeluar;

  const labelPemasukanHeader =
    bukuKasType === 'neraca'
      ? 'PENDAPATAN & PENERIMAAN = SEMUA KATEGORI & JUMLAH'
      : bukuKasType === 'anggota'
      ? 'PEMASUKAN KAS ANGGOTA = SEMUA KATEGORI & JUMLAH'
      : 'PEMASUKAN KAS KOPERASI = SEMUA KATEGORI & JUMLAH';

  const labelPengeluaranHeader =
    bukuKasType === 'neraca'
      ? 'BEBAN & PENGELUARAN OVERHEAD = SEMUA KATEGORI & JUMLAH'
      : bukuKasType === 'anggota'
      ? 'PENGELUARAN KAS ANGGOTA = SEMUA KATEGORI & JUMLAH'
      : 'PENGELUARAN KAS KOPERASI = SEMUA KATEGORI & JUMLAH';

  const labelSubtotalMasuk =
    bukuKasType === 'neraca' ? 'SUBTOTAL PENDAPATAN & PENERIMAAN' : 'SUBTOTAL PEMASUKAN';

  const labelSubtotalKeluar =
    bukuKasType === 'neraca' ? 'SUBTOTAL BEBAN & PENGELUARAN OVERHEAD' : 'SUBTOTAL PENGELUARAN';

  // Halaman Depan: JURNAL REKAPITULASI
  const rowsPemasukan = Array.from(catMasukMap.entries()).map(([cat, data], idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
      <td style="padding: 6px 8px; width: 6%; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 6px 10px; font-weight: 700; color: #047857;">[+] ${cat}</td>
      <td style="padding: 6px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #065f46;">
        ${formatRupiah(data.total)}
      </td>
      <td style="padding: 6px 8px; width: 14%; text-align: center; font-size: 10px; color: #475569;">
        ${data.entries.length} Transaksi
      </td>
    </tr>
  `).join('');

  const rowsPengeluaran = Array.from(catKeluarMap.entries()).map(([cat, data], idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
      <td style="padding: 6px 8px; width: 6%; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 6px 10px; font-weight: 700; color: #b91c1c;">[-] ${cat}</td>
      <td style="padding: 6px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #991b1b;">
        ${formatRupiah(data.total)}
      </td>
      <td style="padding: 6px 8px; width: 14%; text-align: center; font-size: 10px; color: #475569;">
        ${data.entries.length} Transaksi
      </td>
    </tr>
  `).join('');

  // Halaman Selanjutnya: PERINCIAN KATEGORI DENGAN JUDUL KATEGORI
  // Susun semua kategori (tampilkan tanggal, keterangan, serta jumlah)
  const allCategoryDetails: { cat: string; tipe: 'masuk' | 'keluar'; entries: KasEntry[]; total: number }[] = [];
  catMasukMap.forEach((data, cat) => {
    allCategoryDetails.push({ cat, tipe: 'masuk', entries: data.entries, total: data.total });
  });
  catKeluarMap.forEach((data, cat) => {
    allCategoryDetails.push({ cat, tipe: 'keluar', entries: data.entries, total: data.total });
  });

  const categoryDetailSections = allCategoryDetails.map((sec, secIdx) => {
    const sortedEntries = [...sec.entries].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const entriesRows =
      sortedEntries.length > 0
        ? sortedEntries.map((e, eIdx) => `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
              <td style="padding: 5px 8px; width: 5%; text-align: center; color: #64748b;">${eIdx + 1}</td>
              <td style="padding: 5px 8px; width: 15%; font-family: 'JetBrains Mono', monospace; color: #1e293b;">${e.tanggal}</td>
              <td style="padding: 5px 8px; color: #0f172a; font-weight: 500;">${e.keterangan || '-'}</td>
              <td style="padding: 5px 8px; width: 22%; text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: ${sec.tipe === 'masuk' ? '#047857' : '#b91c1c'};">
                ${formatRupiah(e.nominal)} ${sec.tipe === 'masuk' ? '(CR)' : '(DB)'}
              </td>
              <td style="padding: 5px 8px; width: 15%; color: #475569; font-size: 10px;">${e.inputBy || 'Petugas'}</td>
            </tr>
          `).join('')
        : `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
              <td colspan="5" style="padding: 8px 10px; text-align: center; color: #64748b; font-style: italic;">
                Belum ada transaksi pada kategori ini untuk periode yang dipilih (Jumlah: Rp 0)
              </td>
            </tr>
          `;

    const tipeBadge =
      sec.tipe === 'masuk'
        ? (bukuKasType === 'neraca' ? 'PENDAPATAN / PENERIMAAN' : 'PEMASUKAN')
        : (bukuKasType === 'neraca' ? 'BEBAN / PENGELUARAN OVERHEAD' : 'PENGELUARAN');

    return `
      <div style="margin-bottom: 22px; page-break-inside: avoid; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
        <div style="background: ${sec.tipe === 'masuk' ? '#047857' : '#991b1b'}; color: #ffffff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 800; font-size: 12px; text-transform: uppercase;">
            ${secIdx + 1}. JUDUL KATEGORI: ${sec.cat.toUpperCase()} (${tipeBadge})
          </div>
          <div style="font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
            Total Kategori: ${formatRupiah(sec.total)}
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; border-bottom: 1.5px solid #cbd5e1;">
              <th style="padding: 6px 8px; text-align: center;">NO</th>
              <th style="padding: 6px 8px; text-align: left;">TANGGAL</th>
              <th style="padding: 6px 8px; text-align: left;">KETERANGAN</th>
              <th style="padding: 6px 8px; text-align: right;">JUMLAH</th>
              <th style="padding: 6px 8px; text-align: left;">PETUGAS</th>
            </tr>
          </thead>
          <tbody>
            ${entriesRows}
            <tr style="background: #f1f5f9; font-weight: 800; font-size: 11px; border-top: 1.5px solid #cbd5e1;">
              <td colspan="3" style="padding: 6px 10px; text-align: right; text-transform: uppercase;">
                SUBTOTAL KATEGORI [${sec.cat}]:
              </td>
              <td style="padding: 6px 8px; text-align: right; font-family: 'JetBrains Mono', monospace; color: ${sec.tipe === 'masuk' ? '#047857' : '#b91c1c'};">
                ${formatRupiah(sec.total)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  // Bagian Tambahan Khusus Buku Kas 3 Neraca & Konsolidasi Keuangan
  let neracaExtraHtml = '';
  if (bukuKasType === 'neraca') {
    const totalSimpananPokok = allMembers.reduce((sum, m) => sum + (m.saldoPokok || 0), 0);
    const totalSimpananUmum = allMembers.reduce((sum, m) => sum + (m.saldoUmum || 0), 0);
    const totalZakatQurban = allMembers.reduce((sum, m) => sum + (m.saldoZakatFitrah || 0) + (m.saldoQurban || 0), 0);
    const totalAsetLancar = saldoKasAnggota + saldoKasKoperasi;

    neracaExtraHtml = `
      <div style="margin-top: 18px; border: 1.5px solid #0f172a; border-radius: 8px; overflow: hidden;">
        <div style="background: #0f172a; color: #ffffff; padding: 7px 12px; font-weight: 900; font-size: 12px;">
          POSISI KONSOLIDASI NERACA KEUANGAN (KAS & BANK)
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
          <div style="padding: 10px 14px; border-right: 1px solid #cbd5e1;">
            <div style="font-weight: 800; font-size: 11px; color: #b45309; margin-bottom: 6px;">ASET LANCAR (KAS & BANK):</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span>Kas di Bank (Kas Anggota)</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${formatRupiah(saldoKasAnggota)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span>Kas di Bank (Kas Koperasi)</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${formatRupiah(saldoKasKoperasi)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; border-top: 1px dashed #cbd5e1; padding-top: 4px; color: #047857;">
              <span>TOTAL ASET LANCAR</span>
              <span style="font-family: 'JetBrains Mono', monospace;">${formatRupiah(totalAsetLancar)}</span>
            </div>
          </div>

          <div style="padding: 10px 14px;">
            <div style="font-weight: 800; font-size: 11px; color: #0369a1; margin-bottom: 6px;">KOMPONEN SALDO KAS BERJALAN:</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span>1. Total Simpanan Pokok</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${formatRupiah(totalSimpananPokok)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span>2. Total Tabungan Umum</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${formatRupiah(totalSimpananUmum)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
              <span>3. Dana Zakat dan Qurban</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${formatRupiah(totalZakatQurban)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: #be123c;">
              <span>4. Saldo Sedekah Koperasi</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${formatRupiah(saldoSedekahKoperasi)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; border-top: 1.5px solid #047857; padding-top: 5px; color: #047857;">
              <span>SALDO KAS BERJALAN</span>
              <span style="font-family: 'JetBrains Mono', monospace;">${formatRupiah(saldoKasBerjalan ?? (totalSimpananPokok + totalSimpananUmum + totalZakatQurban + saldoSedekahKoperasi))}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="watermark-container">
      <!-- Watermark Background -->
      <div class="watermark-bg" style="display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <div style="font-size: 70px; font-weight: 900; color: #000; opacity: 0.04; transform: rotate(-30deg); text-align: center; line-height: 1.2;">
          KOPERASI HWS<br><span style="font-size: 28px;">DOKUMEN RESMI</span>
        </div>
      </div>

      <div class="content-layer">
        <!-- ================= HALAMAN DEPAN: JURNAL & REKAPITULASI (PAGE 1) ================= -->
        <div style="page-break-after: always; break-after: page; min-height: 94vh; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <!-- Header Dokumen -->
            <div style="border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h1 style="font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
                  KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA
                </h1>
                <div style="font-size: 12px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${titleBuku}
                </div>
                <div style="font-size: 10px; color: #475569; margin-top: 3px;">
                  Badan Hukum: AHU-0004921.AH.01.29.TAHUN 2024 • Wilayah: Cengkareng, Kalideres, Kembangan, Kebon Jeruk
                </div>
              </div>
              <div style="text-align: right; font-size: 10px;">
                <div style="color: #64748b;">Periode Laporan:</div>
                <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${periodeLabel.toUpperCase()}</div>
                <div style="margin-top: 2px; color: #047857; font-weight: 700;">Dokumen Resmi Sah</div>
              </div>
            </div>

            <!-- Jurnal Section Header -->
            <div style="background: #0f172a; color: #ffffff; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 14px; display: flex; justify-content: space-between;">
              <span>HALAMAN 1: JURNAL REKAPITULASI BUKU KAS</span>
              <span>Dicetak: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
            </div>

            <!-- Tabel 1: PEMASUKAN = TAMPILKAN SEMUA KATEGORI, JUMLAH -->
            <div style="margin-bottom: 16px; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background: #047857; color: #ffffff; padding: 7px 12px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
                <span>${labelPemasukanHeader}</span>
                <span style="font-family: 'JetBrains Mono', monospace;">Total: ${formatRupiah(totalMasuk)}</span>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f8fafc; font-size: 10px; color: #475569; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px 8px; text-align: center;">NO</th>
                    <th style="padding: 6px 10px; text-align: left;">${bukuKasType === 'neraca' ? 'KATEGORI PENDAPATAN & PENERIMAAN' : 'KATEGORI PEMASUKAN'}</th>
                    <th style="padding: 6px 10px; text-align: right;">JUMLAH (NOMINAL)</th>
                    <th style="padding: 6px 8px; text-align: center;">FREKUENSI</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsPemasukan || '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #64748b; font-size: 11px;">Tidak ada transaksi pemasukan pada periode ini.</td></tr>'}
                  <tr style="background: #ecfdf5; font-weight: 900; font-size: 11px; border-top: 1.5px solid #047857;">
                    <td colspan="2" style="padding: 8px 10px; color: #047857;">${labelSubtotalMasuk}</td>
                    <td style="padding: 8px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #047857;">
                      ${formatRupiah(totalMasuk)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tabel 2: PENGELUARAN = TAMPILKAN SEMUA KATEGORI, JUMLAH -->
            <div style="margin-bottom: 16px; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <div style="background: #b91c1c; color: #ffffff; padding: 7px 12px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
                <span>${labelPengeluaranHeader}</span>
                <span style="font-family: 'JetBrains Mono', monospace;">Total: ${formatRupiah(totalKeluar)}</span>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f8fafc; font-size: 10px; color: #475569; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px 8px; text-align: center;">NO</th>
                    <th style="padding: 6px 10px; text-align: left;">${bukuKasType === 'neraca' ? 'KATEGORI BEBAN & OVERHEAD' : 'KATEGORI PENGELUARAN'}</th>
                    <th style="padding: 6px 10px; text-align: right;">JUMLAH (NOMINAL)</th>
                    <th style="padding: 6px 8px; text-align: center;">FREKUENSI</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsPengeluaran || '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #64748b; font-size: 11px;">Tidak ada transaksi pengeluaran pada periode ini.</td></tr>'}
                  <tr style="background: #fef2f2; font-weight: 900; font-size: 11px; border-top: 1.5px solid #b91c1c;">
                    <td colspan="2" style="padding: 8px 10px; color: #b91c1c;">${labelSubtotalKeluar}</td>
                    <td style="padding: 8px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #b91c1c;">
                      ${formatRupiah(totalKeluar)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tabel 3: TOTAL = PEMASUKAN - PENGELUARAN -->
            <div style="background: #0f172a; color: #ffffff; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <div>
                <div style="font-size: 12px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
                  TOTAL = PEMASUKAN - PENGELUARAN
                </div>
                <div style="font-size: 10px; color: #94a3b8;">
                  ${bukuKasType === 'neraca' ? 'Surplus / Hasil Usaha Berjalan Koperasi (Pendapatan - Beban Overhead)' : 'Saldo Bersih Kas Berjalan Periode Ini'}
                </div>
              </div>
              <div style="font-size: 18px; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #fbbf24;">
                ${formatRupiah(totalSaldoBersih)}
              </div>
            </div>

            ${neracaExtraHtml}
          </div>

          <!-- Footer Tanda Tangan Halaman 1 -->
          <div style="margin-top: 25px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 10px;">
            <div>
              <div style="color: #64748b; margin-bottom: 45px;">Dibuat Oleh (Admin Kasir),</div>
              <div style="font-weight: 800; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 130px;">
                ( Petugas Koperasi )
              </div>
            </div>
            <div>
              <div style="color: #64748b; margin-bottom: 45px;">Diperiksa Oleh (Pembukuan),</div>
              <div style="font-weight: 800; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 130px;">
                ( Robi Darwis )
              </div>
            </div>
            <div>
              <div style="color: #64748b; margin-bottom: 45px;">Mengetahui (Ketua / Pengawas),</div>
              <div style="font-weight: 800; border-bottom: 1px solid #94a3b8; display: inline-block; min-width: 130px;">
                ( Abzqar )
              </div>
            </div>
          </div>
        </div>

        <!-- ================= HALAMAN SELANJUTNYA: PERINCIAN KATEGORI (PAGE 2+) ================= -->
        <div style="page-break-before: always; break-before: page; padding-top: 10px;">
          <!-- Header Halaman 2 -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <h2 style="font-size: 15px; font-weight: 900; color: #0f172a;">
                HALAMAN 2: PERINCIAN KATEGORI DENGAN JUDUL KATEGORI
              </h2>
              <div style="font-size: 11px; font-weight: 700; color: #b45309;">
                ${titleBuku} • ${periodeLabel.toUpperCase()}
              </div>
            </div>
            <div style="font-size: 10px; color: #64748b; text-align: right;">
              <div>Dokumen Terperinci</div>
              <div style="font-weight: 800; color: #0f172a;">Koperasi HWS</div>
            </div>
          </div>

          <!-- Daftar Perincian per Kategori -->
          ${categoryDetailSections || '<div style="padding: 30px; text-align: center; color: #64748b; font-size: 12px;">Tidak ada perincian transaksi untuk ditampilkan.</div>'}

          <!-- Total Akhir Perincian -->
          <div style="background: #0f172a; color: #ffffff; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
            <div style="font-weight: 900; font-size: 12px; text-transform: uppercase;">
              TOTAL AKUMULASI SELURUH KATEGORI (${allCategoryDetails.length} KATEGORI):
            </div>
            <div style="font-weight: 900; font-size: 16px; font-family: 'JetBrains Mono', monospace; color: #fbbf24;">
              ${formatRupiah(totalSaldoBersih)}
            </div>
          </div>

          <div style="margin-top: 24px; font-size: 9px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
            Laporan Perincian Buku Kas Resmi Koperasi Himpunan Wirausaha Sejahtera. Watermark logo tertanam untuk menjamin keabsahan dokumen.
          </div>
        </div>
      </div>
    </div>
  `;

  printDocumentHtml(html, `Laporan_Buku_Kas_${bukuKasType}_${periodeLabel.replace(/\s+/g, '_')}`);
}

// User Req 1: Buku kas anggota, koperasi / konsolidasi download Excel
export function exportBukuKasExcel(payload: BukuKasExportPayload) {
  const {
    bukuKasType,
    kasEntries,
    periodeLabel,
    allMembers = [],
    categoriesKoperasi,
    saldoKasAnggota = 0,
    saldoKasKoperasi = 0,
    saldoSedekahKoperasi = 0,
    saldoKasBerjalan,
  } = payload;

  const titleBuku =
    bukuKasType === 'anggota'
      ? 'BUKU KAS 1: REKAPITULASI KAS ANGGOTA'
      : bukuKasType === 'koperasi'
      ? 'BUKU KAS 2: OPERASIONAL KAS KOPERASI'
      : 'BUKU KAS 3: NERACA & KONSOLIDASI KEUANGAN';

  const { catMasukMap, catKeluarMap } = getBukuKasCategoryMaps(
    bukuKasType,
    kasEntries,
    categoriesKoperasi
  );

  const totalMasuk = Array.from(catMasukMap.values()).reduce((sum, item) => sum + item.total, 0);
  const totalKeluar = Array.from(catKeluarMap.values()).reduce((sum, item) => sum + item.total, 0);
  const totalSaldoBersih = totalMasuk - totalKeluar;

  const labelPemasukanHeader =
    bukuKasType === 'neraca'
      ? 'PENDAPATAN & PENERIMAAN = SEMUA KATEGORI & JUMLAH'
      : bukuKasType === 'anggota'
      ? 'PEMASUKAN KAS ANGGOTA = SEMUA KATEGORI & JUMLAH'
      : 'PEMASUKAN KAS KOPERASI = SEMUA KATEGORI & JUMLAH';

  const labelPengeluaranHeader =
    bukuKasType === 'neraca'
      ? 'BEBAN & PENGELUARAN OVERHEAD = SEMUA KATEGORI & JUMLAH'
      : bukuKasType === 'anggota'
      ? 'PENGELUARAN KAS ANGGOTA = SEMUA KATEGORI & JUMLAH'
      : 'PENGELUARAN KAS KOPERASI = SEMUA KATEGORI & JUMLAH';

  const labelSubtotalMasuk =
    bukuKasType === 'neraca' ? 'SUBTOTAL PENDAPATAN & PENERIMAAN' : 'SUBTOTAL PEMASUKAN';

  const labelSubtotalKeluar =
    bukuKasType === 'neraca' ? 'SUBTOTAL BEBAN & PENGELUARAN OVERHEAD' : 'SUBTOTAL PENGELUARAN';

  // Build HTML Table for Excel
  let excelHtml = `
    <!-- HEADER LAPORAN -->
    <table>
      <tr>
        <td colspan="5" class="header-title">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</td>
      </tr>
      <tr>
        <td colspan="5" class="sub-title">${titleBuku}</td>
      </tr>
      <tr>
        <td colspan="5">Periode Laporan: <b>${periodeLabel.toUpperCase()}</b> • Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</td>
      </tr>
      <tr>
        <td colspan="5">Badan Hukum: AHU-0004921.AH.01.29.TAHUN 2024</td>
      </tr>
    </table>

    <br/>

    <!-- ================= HALAMAN DEPAN: JURNAL & REKAPITULASI ================= -->
    <table>
      <tr>
        <th colspan="4" style="background-color: #0f172a; color: #ffffff; font-size: 13pt;">
          HALAMAN DEPAN: JURNAL REKAPITULASI BUKU KAS
        </th>
      </tr>
      <tr class="section-header" style="background-color: #047857; color: #ffffff;">
        <td colspan="4"><b>${labelPemasukanHeader}</b></td>
      </tr>
      <tr style="background-color: #f1f5f9; font-weight: bold;">
        <td class="center" style="width: 8%;">NO</td>
        <td style="width: 52%;">${bukuKasType === 'neraca' ? 'KATEGORI PENDAPATAN & PENERIMAAN' : 'KATEGORI PEMASUKAN'}</td>
        <td class="num" style="width: 25%;">JUMLAH (NOMINAL)</td>
        <td class="center" style="width: 15%;">FREKUENSI</td>
      </tr>
  `;

  let noM = 1;
  catMasukMap.forEach((data, cat) => {
    excelHtml += `
      <tr>
        <td class="center">${noM++}</td>
        <td>${cat}</td>
        <td class="num">${formatRupiah(data.total)}</td>
        <td class="center">${data.entries.length} Transaksi</td>
      </tr>
    `;
  });

  excelHtml += `
    <tr style="background-color: #ecfdf5; font-weight: bold;">
      <td colspan="2">${labelSubtotalMasuk}</td>
      <td class="num">${formatRupiah(totalMasuk)}</td>
      <td></td>
    </tr>

    <!-- Spacer -->
    <tr><td colspan="4" style="background-color: #ffffff; height: 12px; border: none;"></td></tr>

    <tr class="section-header" style="background-color: #b91c1c; color: #ffffff;">
      <td colspan="4"><b>${labelPengeluaranHeader}</b></td>
    </tr>
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td class="center">NO</td>
      <td>${bukuKasType === 'neraca' ? 'KATEGORI BEBAN & OVERHEAD' : 'KATEGORI PENGELUARAN'}</td>
      <td class="num">JUMLAH (NOMINAL)</td>
      <td class="center">FREKUENSI</td>
    </tr>
  `;

  let noK = 1;
  catKeluarMap.forEach((data, cat) => {
    excelHtml += `
      <tr>
        <td class="center">${noK++}</td>
        <td>${cat}</td>
        <td class="num">${formatRupiah(data.total)}</td>
        <td class="center">${data.entries.length} Transaksi</td>
      </tr>
    `;
  });

  excelHtml += `
    <tr style="background-color: #fef2f2; font-weight: bold;">
      <td colspan="2">${labelSubtotalKeluar}</td>
      <td class="num">${formatRupiah(totalKeluar)}</td>
      <td></td>
    </tr>

    <!-- Spacer -->
    <tr><td colspan="4" style="background-color: #ffffff; height: 12px; border: none;"></td></tr>

    <tr class="total-row">
      <td colspan="2">TOTAL = PEMASUKAN - PENGELUARAN ${bukuKasType === 'neraca' ? '(SURPLUS / HASIL USAHA BERJALAN)' : ''}</td>
      <td class="num" style="font-size: 12pt; color: #fbbf24;">${formatRupiah(totalSaldoBersih)}</td>
      <td></td>
    </tr>
  </table>
  `;

  // Khusus Neraca: Tambahkan Aset Lancar & Ekuitas
  if (bukuKasType === 'neraca') {
    const totalSimpananPokok = allMembers.reduce((sum, m) => sum + (m.saldoPokok || 0), 0);
    const totalSimpananUmum = allMembers.reduce((sum, m) => sum + (m.saldoUmum || 0), 0);
    const totalZakatQurban = allMembers.reduce((sum, m) => sum + (m.saldoZakatFitrah || 0) + (m.saldoQurban || 0), 0);
    const totalAsetLancar = saldoKasAnggota + saldoKasKoperasi;

    excelHtml += `
      <br/>
      <table>
        <tr>
          <th colspan="4" style="background-color: #0f172a; color: #ffffff; font-size: 12pt;">
            POSISI KONSOLIDASI NERACA KEUANGAN (KAS & BANK)
          </th>
        </tr>
        <tr class="section-header">
          <td colspan="2"><b>ASET LANCAR (KAS & BANK)</b></td>
          <td colspan="2"><b>KEWAJIBAN & EKUITAS</b></td>
        </tr>
        <tr>
          <td>Kas di Bank (Kas Anggota)</td>
          <td class="num">${formatRupiah(saldoKasAnggota)}</td>
          <td>Simpanan Pokok Anggota</td>
          <td class="num">${formatRupiah(totalSimpananPokok)}</td>
        </tr>
        <tr>
          <td>Kas di Bank (Kas Koperasi)</td>
          <td class="num">${formatRupiah(saldoKasKoperasi)}</td>
          <td>Simpanan Umum Anggota</td>
          <td class="num">${formatRupiah(totalSimpananUmum)}</td>
        </tr>
        <tr>
          <td>-</td>
          <td class="num">-</td>
          <td>Dana Zakat dan Qurban</td>
          <td class="num">${formatRupiah(totalZakatQurban)}</td>
        </tr>
        <tr>
          <td>-</td>
          <td class="num">-</td>
          <td>Saldo Sedekah Koperasi</td>
          <td class="num" style="color: #be123c;">${formatRupiah(saldoSedekahKoperasi)}</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL ASET LANCAR</td>
          <td class="num">${formatRupiah(totalAsetLancar)}</td>
          <td>SALDO KAS BERJALAN</td>
          <td class="num" style="color: #047857; font-weight: bold;">${formatRupiah(saldoKasBerjalan ?? (totalSimpananPokok + totalSimpananUmum + totalZakatQurban + saldoSedekahKoperasi))}</td>
        </tr>
      </table>
    `;
  }

  // ================= HALAMAN SELANJUTNYA: PERINCIAN KATEGORI =================
  excelHtml += `
    <br/><br/>
    <table>
      <tr>
        <th colspan="5" style="background-color: #1e293b; color: #ffffff; font-size: 13pt;">
          HALAMAN SELANJUTNYA: PERINCIAN KATEGORI DENGAN JUDUL KATEGORI
        </th>
      </tr>
    </table>
  `;

  // Susun perincian kategori (semua kategori ditampilkan)
  const allDetails: { cat: string; tipe: 'masuk' | 'keluar'; entries: KasEntry[]; total: number }[] = [];
  catMasukMap.forEach((data, cat) => {
    allDetails.push({ cat, tipe: 'masuk', entries: data.entries, total: data.total });
  });
  catKeluarMap.forEach((data, cat) => {
    allDetails.push({ cat, tipe: 'keluar', entries: data.entries, total: data.total });
  });

  allDetails.forEach((sec, idx) => {
    const sorted = [...sec.entries].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const tipeBadge =
      sec.tipe === 'masuk'
        ? (bukuKasType === 'neraca' ? 'PENDAPATAN / PENERIMAAN' : 'PEMASUKAN')
        : (bukuKasType === 'neraca' ? 'BEBAN / PENGELUARAN OVERHEAD' : 'PENGELUARAN');

    excelHtml += `
      <br/>
      <table>
        <tr class="cat-title" style="background-color: ${sec.tipe === 'masuk' ? '#047857' : '#991b1b'}; color: #ffffff;">
          <td colspan="5">
            <b>${idx + 1}. JUDUL KATEGORI: ${sec.cat.toUpperCase()} (${tipeBadge})</b>
          </td>
        </tr>
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td class="center" style="width: 6%;">NO</td>
          <td style="width: 15%;">TANGGAL</td>
          <td style="width: 44%;">KETERANGAN</td>
          <td class="num" style="width: 20%;">JUMLAH (NOMINAL)</td>
          <td style="width: 15%;">PETUGAS</td>
        </tr>
    `;

    if (sorted.length > 0) {
      sorted.forEach((e, eIdx) => {
        excelHtml += `
          <tr>
            <td class="center">${eIdx + 1}</td>
            <td>${e.tanggal}</td>
            <td>${e.keterangan || '-'}</td>
            <td class="num">${formatRupiah(e.nominal)} ${sec.tipe === 'masuk' ? '(CR)' : '(DB)'}</td>
            <td>${e.inputBy || 'Petugas'}</td>
          </tr>
        `;
      });
    } else {
      excelHtml += `
        <tr>
          <td colspan="5" style="text-align: center; color: #64748b; font-style: italic;">
            Belum ada transaksi pada kategori ini untuk periode yang dipilih (Jumlah: Rp 0)
          </td>
        </tr>
      `;
    }

    excelHtml += `
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="3" style="text-align: right;">SUBTOTAL KATEGORI [${sec.cat.toUpperCase()}]:</td>
          <td class="num" style="color: ${sec.tipe === 'masuk' ? '#047857' : '#b91c1c'};">${formatRupiah(sec.total)}</td>
          <td></td>
        </tr>
      </table>
    `;
  });

  excelHtml += `
    <br/>
    <table>
      <tr class="total-row">
        <td colspan="3">GRAND TOTAL KESELURUHAN PERINCIAN (${allDetails.length} KATEGORI)</td>
        <td class="num" style="font-size: 13pt; color: #fbbf24;">${formatRupiah(totalSaldoBersih)}</td>
        <td></td>
      </tr>
    </table>
  `;

  downloadExcelHtml(excelHtml, `Laporan_Buku_Kas_${bukuKasType}_${periodeLabel.replace(/\s+/g, '_')}`);
}

// ==========================================
// LAPORAN BERBAGI & SEDEKAH (PDF & EXCEL)
// Req 2: Sedekah Subuh, Sedekah Jumat, Sedekah Umum
// Unduh Laporan Tahunan dan Bulanan sesuai periode yang diinginkan
// ==========================================
export interface LaporanBerbagiExportPayload {
  entries: SedekahBerbagiEntry[];
  periodeTipe: 'harian' | 'bulanan' | 'tahunan' | 'semua';
  periodeLabel: string;
  wilayahLabel?: string;
  memberLabel?: string;
  kategoriFilter: string;
  totalPenerimaan: number;
  totalPenyaluran: number;
  saldoTersedia: number;
  subuhTotal: number;
  jumatTotal: number;
  umumTotal: number;
  namaBerbagiMap?: Record<string, string>;
}

export function exportLaporanBerbagiPdf(payload: LaporanBerbagiExportPayload) {
  const {
    entries,
    periodeLabel,
    wilayahLabel = 'Keseluruhan Wilayah',
    memberLabel = 'Semua Anggota',
    totalPenerimaan,
    totalPenyaluran,
    saldoTersedia,
    subuhTotal,
    jumatTotal,
    umumTotal,
    namaBerbagiMap,
  } = payload;

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getJenisLabel = (jenis: string) => {
    if (namaBerbagiMap && namaBerbagiMap[jenis]) return namaBerbagiMap[jenis];
    if (jenis === 'sedekah_subuh') return 'Sedekah Subuh';
    if (jenis === 'sedekah_jumat') return 'Sedekah Jumat';
    if (jenis === 'sedekah_umum') return 'Sedekah Umum';
    return jenis;
  };

  let runningTotalPdf = 0;
  const rowsHtml = entries.length === 0
    ? `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b; font-style: italic;">Belum ada catatan mutasi dana berbagi / sedekah pada kriteria filter ini.</td></tr>`
    : entries
        .map((e, idx) => {
          const isMasuk = e.tipe === 'penerimaan';
          const namaOrang = isMasuk
            ? (e.donaturNama || 'Hamba Allah')
            : (e.penerimaManfaat || 'Penerima Manfaat');
          const wilayahOrang = isMasuk ? (e.donaturWilayah || '-') : 'Penyaluran Sosial';
          const namaBerbagi = e.namaBerbagiKustom || getJenisLabel(e.jenis);
          const perOrangNominal = e.nominal;
          runningTotalPdf += (isMasuk ? perOrangNominal : -perOrangNominal);

          const statusText = isMasuk
            ? (e.status === 'approved' ? 'Terverifikasi' : e.status === 'rejected' ? 'Ditolak' : 'Pending Verifikasi')
            : (e.status === 'approved' ? 'Tersalurkan Resmi' : 'Menunggu Approval');
          const statusColor = isMasuk
            ? (e.status === 'approved' ? '#047857' : e.status === 'rejected' ? '#b91c1c' : '#d97706')
            : (e.status === 'approved' ? '#0284c7' : '#d97706');

          return `
            <tr>
              <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
              <td style="white-space: nowrap; font-size: 8.5pt;">${e.tanggal} <span style="font-size: 7.5pt; color: #64748b;">${e.jam || ''}</span></td>
              <td style="font-weight: 700; color: #0f172a;">${namaOrang}</td>
              <td style="font-size: 8.5pt; font-weight: 600; color: #475569;">${wilayahOrang}</td>
              <td><span style="font-weight: 700; color: #0284c7;">${namaBerbagi}</span></td>
              <td class="num" style="font-weight: 800; color: ${isMasuk ? '#047857' : '#b45309'}; white-space: nowrap;">
                ${isMasuk ? '+' : '-'}${formatRupiah(perOrangNominal)}
              </td>
              <td class="num" style="font-weight: 900; color: #0f172a; white-space: nowrap;">
                ${formatRupiah(runningTotalPdf)}
              </td>
              <td style="text-align: center; font-size: 8pt; font-weight: 700; color: ${statusColor};">${statusText}</td>
            </tr>
          `;
        })
        .join('');

  const html = `
    <div class="header">
      <div class="logo-box">HWS</div>
      <div class="header-text">
        <h2>KOPERASI SIMPAN PINJAM HARAPAN WARGA SEJAHTERA (HWS)</h2>
        <p>Layanan Program Sosial & Keumatan • Unit Pengelola Dana Berbagi Syariah</p>
        <p class="meta">Badan Hukum No: AHU-0012948.AH.01.29.TAHUN 2024 • NPWP: 29.839.201.2-412.000</p>
      </div>
    </div>

    <div style="background: linear-gradient(135deg, #0284c7 0%, #0f172a 100%); color: white; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px;">
      <h3 style="font-size: 13pt; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
        LAPORAN MUTASI DANA BERBAGI & SEDEKAH KOPERASI
      </h3>
      <div style="font-size: 9pt; opacity: 0.95; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 14px;">
        <span>Periode: <b>${periodeLabel}</b></span>
        <span>Wilayah: <b>${wilayahLabel}</b></span>
        <span>Filter Anggota: <b>${memberLabel}</b></span>
        <span>Tanggal Cetak: <b>${tanggalCetak}</b></span>
      </div>
    </div>

    <!-- Ringkasan Saldo Berbagi -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
      <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 10px 14px;">
        <div style="font-size: 8.5pt; color: #166534; font-weight: 700; text-transform: uppercase;">Total Penerimaan Sedekah</div>
        <div style="font-size: 14pt; font-weight: 900; color: #15803d; margin-top: 3px;">${formatRupiah(totalPenerimaan)}</div>
        <div style="font-size: 7.5pt; color: #166534; margin-top: 2px;">Tercatat pada Buku Kas Koperasi</div>
      </div>
      <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 8px; padding: 10px 14px;">
        <div style="font-size: 8.5pt; color: #854d0e; font-weight: 700; text-transform: uppercase;">Total Penyaluran Oleh Admin</div>
        <div style="font-size: 14pt; font-weight: 900; color: #a16207; margin-top: 3px;">${formatRupiah(totalPenyaluran)}</div>
        <div style="font-size: 7.5pt; color: #854d0e; margin-top: 2px;">Disalurkan resmi kepada mustahiq</div>
      </div>
      <div style="background: #f0f9ff; border: 1.5px solid #7dd3fc; border-radius: 8px; padding: 10px 14px;">
        <div style="font-size: 8.5pt; color: #075985; font-weight: 700; text-transform: uppercase;">Saldo Kas Berbagi Siap Salur</div>
        <div style="font-size: 14pt; font-weight: 900; color: #0369a1; margin-top: 3px;">${formatRupiah(saldoTersedia)}</div>
        <div style="font-size: 7.5pt; color: #075985; margin-top: 2px;">Dana sosial siap disalurkan</div>
      </div>
    </div>

    <!-- Rincian Kategori Sedekah -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
      <div style="font-size: 8.5pt; font-weight: 800; color: #334155; margin-bottom: 6px; text-transform: uppercase;">
        Rincian Pengumpulan Sesuai Pilihan Sedekah:
      </div>
      <div style="display: flex; gap: 20px; font-size: 9pt;">
        <div>🌅 <b>${getJenisLabel('sedekah_subuh')}:</b> <span style="font-weight: 800; color: #0f172a;">${formatRupiah(subuhTotal)}</span></div>
        <div>🕌 <b>${getJenisLabel('sedekah_jumat')}:</b> <span style="font-weight: 800; color: #0f172a;">${formatRupiah(jumatTotal)}</span></div>
        <div>✨ <b>${getJenisLabel('sedekah_umum')}:</b> <span style="font-weight: 800; color: #0f172a;">${formatRupiah(umumTotal)}</span></div>
      </div>
      <div style="font-size: 7.5pt; color: #64748b; margin-top: 5px; font-style: italic;">
        * Ketentuan: Dana sedekah masuk ke pos Buku Kas Koperasi dan tidak dapat ditarik kembali oleh anggota.
      </div>
    </div>

    <!-- Tabel Mutasi -->
    <h4 style="font-size: 10pt; font-weight: 800; color: #0f172a; margin-bottom: 6px; text-transform: uppercase;">
      Daftar Mutasi Transaksi Per Donatur & Penyaluran:
    </h4>
    <table>
      <thead>
        <tr>
          <th style="width: 28px; text-align: center;">No</th>
          <th style="width: 80px;">Tanggal</th>
          <th style="width: 130px;">Nama</th>
          <th style="width: 85px;">Wilayah</th>
          <th style="width: 105px;">Nama Sedekah</th>
          <th style="width: 105px;" class="num">Jumlah Per Orang</th>
          <th style="width: 115px;" class="num">Jumlah Keseluruhan</th>
          <th style="width: 85px; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" style="text-align: right; font-weight: 800;">TOTAL PENERIMAAN DANA (JUMLAH KESELURUHAN):</td>
          <td colspan="2" class="num" style="font-size: 10pt; color: #047857; font-weight: 900;">${formatRupiah(totalPenerimaan)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="6" style="text-align: right; font-weight: 800;">TOTAL PENYALURAN DANA OLEH ADMIN:</td>
          <td colspan="2" class="num" style="font-size: 10pt; color: #b45309; font-weight: 900;">${formatRupiah(totalPenyaluran)}</td>
        </tr>
        <tr class="total-row" style="background-color: #e0f2fe;">
          <td colspan="6" style="text-align: right; font-weight: 900; color: #0369a1;">SISA SALDO KAS BERBAGI SIAP SALUR:</td>
          <td colspan="2" class="num" style="font-size: 11pt; color: #0369a1; font-weight: 900;">${formatRupiah(saldoTersedia)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer-sign">
      <div class="sign-box">
        <p>Disiapkan Oleh,</p>
        <p class="title">Pengurus Bagian Sosial</p>
        <div class="line"></div>
        <p class="name">Admin Kasir Koperasi HWS</p>
      </div>
      <div class="sign-box">
        <p>Disahkan & Diketahui,</p>
        <p class="title">Ketua / Super Admin Koperasi</p>
        <div class="line"></div>
        <p class="name">Abzqar (Super Admin)</p>
      </div>
    </div>
  `;

  printDocumentHtml(html, `Laporan_Dana_Berbagi_${periodeLabel.replace(/\s+/g, '_')}`);
}

export function exportLaporanBerbagiExcel(payload: LaporanBerbagiExportPayload) {
  const {
    entries,
    periodeLabel,
    wilayahLabel = 'Keseluruhan Wilayah',
    memberLabel = 'Semua Anggota',
    totalPenerimaan,
    totalPenyaluran,
    saldoTersedia,
    subuhTotal,
    jumatTotal,
    umumTotal,
    namaBerbagiMap,
  } = payload;

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getJenisLabel = (jenis: string) => {
    if (namaBerbagiMap && namaBerbagiMap[jenis]) return namaBerbagiMap[jenis];
    if (jenis === 'sedekah_subuh') return 'Sedekah Subuh';
    if (jenis === 'sedekah_jumat') return 'Sedekah Jumat';
    if (jenis === 'sedekah_umum') return 'Sedekah Umum';
    return jenis;
  };

  let runningTotalExcel = 0;
  const rowsExcel = entries.length === 0
    ? `<tr><td colspan="8" style="text-align:center; padding:12px; color:#64748b;">Belum ada catatan mutasi dana berbagi / sedekah pada kriteria filter ini.</td></tr>`
    : entries
        .map((e, idx) => {
          const isMasuk = e.tipe === 'penerimaan';
          const namaOrang = isMasuk
            ? (e.donaturNama || 'Hamba Allah')
            : (e.penerimaManfaat || 'Penerima Manfaat');
          const wilayahOrang = isMasuk ? (e.donaturWilayah || '-') : 'Penyaluran Sosial';
          const namaBerbagi = e.namaBerbagiKustom || getJenisLabel(e.jenis);
          const perOrang = e.nominal;
          runningTotalExcel += (isMasuk ? perOrang : -perOrang);

          const statusText = isMasuk
            ? (e.status === 'approved' ? 'Terverifikasi' : e.status === 'rejected' ? 'Ditolak' : 'Pending Verifikasi')
            : (e.status === 'approved' ? 'Tersalurkan Resmi' : 'Menunggu Approval');

          return `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td style="text-align:center;">${e.tanggal} ${e.jam || ''}</td>
              <td style="font-weight:bold;">${namaOrang}</td>
              <td style="text-align:center;">${wilayahOrang}</td>
              <td style="font-weight:bold;">${namaBerbagi}</td>
              <td class="num" style="font-weight:bold; color:${isMasuk ? '#166534' : '#854d0e'};">${isMasuk ? '' : '-'}${perOrang}</td>
              <td class="num" style="font-weight:bold; color:#0f172a;">${runningTotalExcel}</td>
              <td style="text-align:center; font-weight:bold;">${statusText}</td>
            </tr>
          `;
        })
        .join('');

  const excelHtml = `
    <div class="banner">
      <h2>KOPERASI HARAPAN WARGA SEJAHTERA (HWS)</h2>
      <p>LAPORAN DANA BERBAGI & SEDEKAH</p>
      <p>Periode: ${periodeLabel} | Wilayah: ${wilayahLabel} | Filter Anggota: ${memberLabel} | Dicetak: ${tanggalCetak}</p>
    </div>

    <table>
      <tr class="header-cat">
        <th colspan="2">RINGKASAN POS DANA BERBAGI KOPERASI</th>
      </tr>
      <tr>
        <td style="font-weight:bold;">Total Penerimaan Sedekah (Buku Kas Koperasi)</td>
        <td class="num" style="font-weight:bold; color:#166534;">${formatRupiah(totalPenerimaan)}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;">Total Penyaluran Oleh Admin</td>
        <td class="num" style="font-weight:bold; color:#854d0e;">${formatRupiah(totalPenyaluran)}</td>
      </tr>
      <tr class="total-row">
        <td>SISA SALDO KAS BERBAGI TERSEDIA</td>
        <td class="num" style="font-size:12pt; color:#0369a1;">${formatRupiah(saldoTersedia)}</td>
      </tr>
      <tr>
        <td colspan="2" style="font-size:8pt; color:#64748b; font-style:italic;">
          * Ketentuan: Dana sedekah masuk ke kas koperasi dan disalurkan oleh admin, tidak dapat ditarik oleh anggota.
        </td>
      </tr>
    </table>

    <br/>
    <table>
      <tr class="header-cat">
        <th colspan="2">PENGUMPULAN PER KATEGORI SEDEKAH</th>
      </tr>
      <tr>
        <td>${getJenisLabel('sedekah_subuh')}</td>
        <td class="num" style="font-weight:bold;">${formatRupiah(subuhTotal)}</td>
      </tr>
      <tr>
        <td>${getJenisLabel('sedekah_jumat')}</td>
        <td class="num" style="font-weight:bold;">${formatRupiah(jumatTotal)}</td>
      </tr>
      <tr>
        <td>${getJenisLabel('sedekah_umum')}</td>
        <td class="num" style="font-weight:bold;">${formatRupiah(umumTotal)}</td>
      </tr>
    </table>

    <br/>
    <table>
      <thead>
        <tr>
          <th>NO</th>
          <th>TANGGAL & JAM</th>
          <th>NAMA</th>
          <th>WILAYAH</th>
          <th>NAMA SEDEKAH</th>
          <th>JUMLAH PER ORANG (RP)</th>
          <th>JUMLAH KESELURUHAN (RP)</th>
          <th>STATUS</th>
        </tr>
      </thead>
      <tbody>
        ${rowsExcel}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5" style="text-align:right; font-weight:bold;">TOTAL PENERIMAAN (JUMLAH KESELURUHAN):</td>
          <td colspan="3" class="num" style="color:#166534; font-weight:bold;">${formatRupiah(totalPenerimaan)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="5" style="text-align:right; font-weight:bold;">TOTAL PENYALURAN OLEH ADMIN:</td>
          <td colspan="3" class="num" style="color:#854d0e; font-weight:bold;">${formatRupiah(totalPenyaluran)}</td>
        </tr>
        <tr class="total-row" style="background-color:#e0f2fe;">
          <td colspan="5" style="text-align:right; font-weight:bold; color:#0369a1;">SISA SALDO KAS BERBAGI SIAP SALUR:</td>
          <td colspan="3" class="num" style="color:#0369a1; font-weight:bold;">${formatRupiah(saldoTersedia)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  downloadExcelHtml(excelHtml, `Laporan_Dana_Berbagi_${periodeLabel.replace(/\s+/g, '_')}`);
}

