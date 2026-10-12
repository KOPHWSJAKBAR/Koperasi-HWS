import struct, os

def build_pe(url_str="https://ais-dev-ceuwz66sqfjoknexm5gbdu-284535189588.asia-southeast1.run.app"):
    url_bytes = url_str.encode('ascii') + b'\x00'
    open_bytes = b'open\x00'
    
    image_base = 0x00400000
    text_rva = 0x1000
    rdata_rva = 0x2000
    
    idt_size = 20 * 3
    ilt_shell_off = idt_size
    ilt_kernel_off = ilt_shell_off + 8
    iat_shell_off = ilt_kernel_off + 8
    iat_kernel_off = iat_shell_off + 8
    
    str_off = iat_kernel_off + 8
    shell32_name_off = str_off
    shell32_name = b'shell32.dll\x00'
    str_off += len(shell32_name)
    
    kernel32_name_off = str_off
    kernel32_name = b'kernel32.dll\x00'
    str_off += len(kernel32_name)
    
    hint_shell_off = str_off
    hint_shell = struct.pack('<H', 0) + b'ShellExecuteA\x00'
    str_off += len(hint_shell)
    if str_off % 2 != 0:
        str_off += 1
        
    hint_kernel_off = str_off
    hint_kernel = struct.pack('<H', 0) + b'ExitProcess\x00'
    str_off += len(hint_kernel)
    if str_off % 2 != 0:
        str_off += 1
        
    open_str_off = str_off
    str_off += len(open_bytes)
    
    url_str_off = str_off
    str_off += len(url_bytes)
    
    rdata_len = str_off
    rdata_raw_size = ((rdata_len + 0x1ff) // 0x200) * 0x200
    rdata = bytearray(rdata_raw_size)
    
    struct.pack_into('<IIIII', rdata, 0,
                     rdata_rva + ilt_shell_off,
                     0, 0,
                     rdata_rva + shell32_name_off,
                     rdata_rva + iat_shell_off)
    struct.pack_into('<IIIII', rdata, 20,
                     rdata_rva + ilt_kernel_off,
                     0, 0,
                     rdata_rva + kernel32_name_off,
                     rdata_rva + iat_kernel_off)
    
    struct.pack_into('<II', rdata, ilt_shell_off, rdata_rva + hint_shell_off, 0)
    struct.pack_into('<II', rdata, ilt_kernel_off, rdata_rva + hint_kernel_off, 0)
    struct.pack_into('<II', rdata, iat_shell_off, rdata_rva + hint_shell_off, 0)
    struct.pack_into('<II', rdata, iat_kernel_off, rdata_rva + hint_kernel_off, 0)
    
    rdata[shell32_name_off:shell32_name_off+len(shell32_name)] = shell32_name
    rdata[kernel32_name_off:kernel32_name_off+len(kernel32_name)] = kernel32_name
    rdata[hint_shell_off:hint_shell_off+len(hint_shell)] = hint_shell
    rdata[hint_kernel_off:hint_kernel_off+len(hint_kernel)] = hint_kernel
    rdata[open_str_off:open_str_off+len(open_bytes)] = open_bytes
    rdata[url_str_off:url_str_off+len(url_bytes)] = url_bytes
    
    code = bytearray()
    code.extend(b'\x6a\x01')  # SW_SHOWNORMAL
    code.extend(b'\x6a\x00')
    code.extend(b'\x6a\x00')
    
    url_va = image_base + rdata_rva + url_str_off
    code.extend(b'\x68' + struct.pack('<I', url_va))
    
    open_va = image_base + rdata_rva + open_str_off
    code.extend(b'\x68' + struct.pack('<I', open_va))
    
    code.extend(b'\x6a\x00')
    
    iat_shell_va = image_base + rdata_rva + iat_shell_off
    code.extend(b'\xff\x15' + struct.pack('<I', iat_shell_va))
    
    code.extend(b'\x6a\x00')
    iat_kernel_va = image_base + rdata_rva + iat_kernel_off
    code.extend(b'\xff\x15' + struct.pack('<I', iat_kernel_va))
    
    code.extend(b'\xc3')
    
    text_raw_size = 0x200
    text_sec = bytearray(text_raw_size)
    text_sec[:len(code)] = code
    
    dos_header = bytearray(64)
    dos_header[0:2] = b'MZ'
    struct.pack_into('<H', dos_header, 0x3c, 0x80)
    
    dos_stub = b'\x0e\x1f\xba\x0e\x00\xb4\x09\xcd\x21\xb8\x01\x4c\xcd\x21' + \
               b'This program cannot be run in DOS mode.\r\r\n$\x00\x00\x00\x00\x00\x00\x00'
    dos_stub = dos_stub.ljust(64, b'\x00')
    
    pe_sig = b'PE\x00\x00'
    
    coff_header = struct.pack(
        '<HHIIIHH',
        0x014c, 2, 0, 0, 0, 0x00e0, 0x0102
    )
    
    magic = 0x010b
    opt_std = struct.pack(
        '<HBBIIIIII',
        magic, 1, 0,
        text_raw_size, rdata_raw_size, 0,
        text_rva, text_rva, rdata_rva
    )
    
    opt_win = struct.pack(
        '<IIIHHHHHHIIIIHHIIIIII',
        image_base, 0x1000, 0x200,
        4, 0, 1, 0, 4, 0,
        0, 0x3000, 0x200, 0,
        2, 0x8140,
        0x100000, 0x1000, 0x100000, 0x1000,
        0, 16
    )
    
    data_dirs = bytearray(16 * 8)
    struct.pack_into('<II', data_dirs, 8, rdata_rva, idt_size)
    struct.pack_into('<II', data_dirs, 12 * 8, rdata_rva + iat_shell_off, 16)
    
    sec_text = struct.pack(
        '<8sIIIIIIHHI',
        b'.text\x00\x00\x00',
        len(code), text_rva, text_raw_size, 0x200,
        0, 0, 0, 0, 0x60000020
    )
    sec_rdata = struct.pack(
        '<8sIIIIIIHHI',
        b'.rdata\x00\x00',
        rdata_len, rdata_rva, rdata_raw_size, 0x400,
        0, 0, 0, 0, 0x40000040
    )
    
    headers = dos_header + dos_stub + pe_sig + coff_header + opt_std + opt_win + data_dirs + sec_text + sec_rdata
    headers = headers.ljust(0x200, b'\x00')
    
    return headers + text_sec + rdata

if __name__ == '__main__':
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "https://koperasi-hws.id"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "/app/applet/data/koperasi-hws-setup.exe"
    pe = build_pe(url)
    with open(out_path, 'wb') as f:
        f.write(pe)
    print(f"Generated PE for {url} to {out_path} ({len(pe)} bytes)")
