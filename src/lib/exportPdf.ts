import { MemberUser, MemberTransaction, KategoriTabunganMutasi } from '../types';
import { formatRupiah } from './storage';

// Helper to open a clean print window with accurate styling and triggers browser PDF printing
export function printDocumentHtml(htmlContent: string, title: string = 'Dokumen Koperasi HWS') {
  const printWindow = window.open('', '_blank', 'width=900,height=800');
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
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
        }
        body {
          background-color: #ffffff;
          color: #111827;
          padding: 20px;
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
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.055;
          width: 420px;
          height: 420px;
          pointer-events: none;
          z-index: 0;
        }
        .content-layer {
          position: relative;
          z-index: 10;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; padding: 12px 16px; background: #0d1424; color: #fff; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; font-size: 14px;">Pratinjau PDF Cetak Resmi Koperasi HWS</span>
        <button onclick="window.print()" style="background: #f59e0b; color: #000; font-weight: 700; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px;">
          🖨️ Cetak / Simpan PDF
        </button>
      </div>
      ${htmlContent}
      <script>
        window.onload = function() {
          // slight delay for rendering fonts
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Generate exact BCA Rekening Tahapan style for member mutasi
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
  // Filter transactions
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

  // Sort chronological: requirement 55 "urutannya dari awal ada di atas serta selanjutnya ke bawah"
  filtered.sort((a, b) => {
    const da = `${a.tanggal} ${a.jam || '00:00'}`;
    const db = `${b.tanggal} ${b.jam || '00:00'}`;
    return da.localeCompare(db);
  });

  // Calculate totals
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

  // Saldo awal dari hari sebelumnya
  const saldoAwal = 0;
  const saldoAkhir = saldoAwal + totalMasuk - totalKeluar;

  let kategoriTitle = 'SEMUA TABUNGAN';
  if (options.kategori === 'pokok') kategoriTitle = 'TABUNGAN POKOK / WAJIB';
  if (options.kategori === 'umum') kategoriTitle = 'TABUNGAN UMUM BEBAS';

  const rowsHtml = filtered.length === 0
    ? `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #6b7280; font-size: 13px;">Tidak ada transaksi pada periode ini. Saldo: ${formatRupiah(0)}</td></tr>`
    : filtered
        .map((tx) => {
          const formattedTgl = tx.tanggal.split('-').reverse().slice(0, 2).join('/');
          const isMasuk = tx.tipe === 'masuk';
          const mutasiStr = `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.nominal)} ${isMasuk ? 'CR' : 'DB'}`;
          const saldoStr = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.saldoSetelah);

          return `
            <tr style="border-bottom: 1px dashed #e5e7eb; font-size: 11px;">
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

      <div class="content-layer">
        <!-- Top Header: Logo HWS & Title -->
        <table style="width: 100%; margin-bottom: 12px; border-collapse: collapse;">
          <tr>
            <td style="width: 25%; vertical-align: middle;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="44" height="44" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000000" stroke-width="2" />
                  <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
                  <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
                  <polygon points="100,54 124,68 124,106 100,120 76,106 76,68" fill="#007ACC" />
                </svg>
                <div>
                  <div style="font-weight: 900; font-size: 15px; color: #0f172a; letter-spacing: 0.5px;">KOPERASI HWS</div>
                  <div style="font-size: 9px; color: #4b5563; font-weight: 700; text-transform: uppercase;">KCP ${member.wilayah.toUpperCase()}</div>
                </div>
              </div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0d1424; margin: 0; text-transform: uppercase;">
                REKENING TAHAPAN
              </h1>
              <div style="font-size: 11px; font-weight: 700; color: #d97706; margin-top: 2px;">
                ${kategoriTitle}
              </div>
            </td>
            <td style="width: 25%; text-align: right; vertical-align: middle;">
              <span style="font-size: 10px; color: #6b7280; font-family: 'JetBrains Mono', monospace;">HWS-EST-2024</span>
            </td>
          </tr>
        </table>

        <!-- Two Box Layout: Left (Member Info), Right (Account Info) -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 12px;">
          <tr>
            <!-- Left Box: Member Info (Without Koperasi Address per req 22) -->
            <td style="width: 52%; border: 1.5px solid #111827; border-radius: 4px; padding: 10px 12px; vertical-align: top; font-size: 11px; line-height: 1.45;">
              <div style="font-weight: 800; font-size: 13px; text-transform: uppercase; color: #111827;">${member.nama}</div>
              <div style="font-weight: 700; color: #374151;">KEC ${member.kecamatan ? member.kecamatan.toUpperCase() : member.wilayah.toUpperCase()}</div>
              <div>RT ${member.rt || '001'} RW ${member.rw || '001'} ${member.kelurahan ? 'KEL ' + member.kelurahan.toUpperCase() : ''}</div>
              <div>${member.alamatLengkap ? member.alamatLengkap.toUpperCase() : 'JL RAYA JAKARTA'}</div>
              <div>${member.kota ? member.kota.toUpperCase() : 'JAKARTA'} ${member.kodePos || '11740'}</div>
              <div style="font-weight: 700;">INDONESIA</div>
            </td>

            <!-- Right Box: Account Meta -->
            <td style="width: 48%; border: 1.5px solid #111827; border-radius: 4px; padding: 10px 12px; vertical-align: top; font-size: 11px; line-height: 1.5;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 38%; font-weight: 700;">NO. REKENING</td>
                  <td style="width: 5%;">:</td>
                  <td style="font-weight: 800; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #0d1424;">${member.nomorRekening}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">NO. ANGGOTA</td>
                  <td>:</td>
                  <td style="font-weight: 700; font-family: 'JetBrains Mono', monospace;">${member.nomorAnggota}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">HALAMAN</td>
                  <td>:</td>
                  <td>1 / 1</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">PERIODE</td>
                  <td>:</td>
                  <td style="font-weight: 700; text-transform: uppercase;">${options.periodeLabel}</td>
                </tr>
                <tr>
                  <td style="font-weight: 700;">MATA UANG</td>
                  <td>:</td>
                  <td style="font-weight: 700;">IDR</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Catatan Box (Disclaimer) -->
        <div style="border: 1.5px solid #111827; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 9px; line-height: 1.35; color: #1f2937;">
          <div style="font-weight: 800; margin-bottom: 2px;">CATATAN :</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; padding-right: 8px; vertical-align: top;">
                • Apabila nasabah tidak melakukan sanggahan atas Laporan Mutasi Rekening ini sampai dengan akhir bulan berikutnya, nasabah dianggap telah menyetujui segala data yang tercantum pada Laporan Mutasi Rekening ini.
              </td>
              <td style="width: 50%; padding-left: 8px; vertical-align: top;">
                • Koperasi HWS berhak setiap saat melakukan koreksi apabila ada kesalahan pencatatan pada Laporan Mutasi Rekening.
              </td>
            </tr>
          </table>
        </div>

        <!-- Table of Transactions -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1.5px solid #111827;">
          <thead>
            <tr style="border-bottom: 1.5px solid #111827; background-color: #f9fafb; font-size: 10px; font-weight: 800; text-transform: uppercase;">
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

        <!-- Summary Box at Bottom -->
        <div style="display: flex; justify-content: flex-end;">
          <table style="width: 50%; border-collapse: collapse; font-size: 11px; font-family: 'JetBrains Mono', monospace;">
            <tr>
              <td style="padding: 3px 6px; font-weight: 700;">SALDO AWAL</td>
              <td style="width: 4%;">:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 700;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAwal)}</td>
              <td style="width: 12%;"></td>
            </tr>
            <tr>
              <td style="padding: 3px 6px; font-weight: 700; color: #047857;">MUTASI CR (MASUK)</td>
              <td>:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 700; color: #047857;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalMasuk)}</td>
              <td style="padding: 3px 6px; text-align: right; color: #4b5563;">${countMasuk}</td>
            </tr>
            <tr>
              <td style="padding: 3px 6px; font-weight: 700; color: #b91c1c;">MUTASI DB (KELUAR)</td>
              <td>:</td>
              <td style="padding: 3px 6px; text-align: right; font-weight: 700; color: #b91c1c;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalKeluar)}</td>
              <td style="padding: 3px 6px; text-align: right; color: #4b5563;">${countKeluar}</td>
            </tr>
            <tr style="border-top: 1.5px solid #111827;">
              <td style="padding: 4px 6px; font-weight: 800; font-size: 12px;">SALDO AKHIR</td>
              <td>:</td>
              <td style="padding: 4px 6px; text-align: right; font-weight: 900; font-size: 12px;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAkhir)}</td>
              <td></td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 24px; font-size: 9px; color: #6b7280; text-align: center; border-top: 1px dashed #d1d5db; padding-top: 8px;">
          Dokumen ini diterbitkan secara sah dan otomatis oleh Sistem Elektronik Koperasi Himpunan Wirausaha Sejahtera (Koperasi HWS). Tidak memerlukan tanda tangan basah pengurus atau pemilik rekening.
        </div>
      </div>
    </div>
  `;

  printDocumentHtml(html, `Mutasi_Rekening_${member.nomorRekening}_${options.periodeLabel.replace(/\s+/g, '_')}`);
}

// Helper: Download Array of Objects as CSV / Excel
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
