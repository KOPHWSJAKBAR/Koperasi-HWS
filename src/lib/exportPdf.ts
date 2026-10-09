import { MemberUser, MemberTransaction, KategoriTabunganMutasi } from '../types';
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
