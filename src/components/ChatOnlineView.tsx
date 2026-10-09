import React, { useState, useEffect, useRef } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  ChatMessage,
} from '../types';
import { downloadExcelCsv } from '../lib/exportPdf';
import {
  MessageSquare,
  Send,
  User,
  Shield,
  Download,
  Check,
  CheckCheck,
  Phone,
  Video,
  Smile,
  Paperclip,
} from 'lucide-react';

interface ChatOnlineViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin?: AdminUser;
  currentMember?: MemberUser;
}

export const ChatOnlineView: React.FC<ChatOnlineViewProps> = ({
  state,
  updateState,
  currentAdmin,
  currentMember,
}) => {
  const isMember = !!currentMember;
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    isMember ? currentMember.id : state.members[0]?.id || ''
  );
  const [inputPesan, setInputPesan] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Group messages by member
  // Sort members for admin: requirement "tampilkan chat diatas pada orang terakhir pesan masuk pada chat pilihan menu chat pada admin seperti pada whatsaap aplikasi"
  const memberListWithLastMsg = state.members.map((mem) => {
    const memMsgs = state.chatMessages.filter((m) => m.memberId === mem.id);
    const lastMsg = memMsgs[memMsgs.length - 1];
    const unreadCount = memMsgs.filter((m) => m.senderType === 'member' && !m.isReadByAdmin).length;
    return {
      member: mem,
      lastMsg,
      unreadCount,
      lastTimestamp: lastMsg ? new Date(lastMsg.timestamp).getTime() : 0,
    };
  });

  // Sort descending by last message timestamp
  memberListWithLastMsg.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

  // Active member object
  const activeMember = state.members.find((m) => m.id === selectedMemberId);

  // Current active conversation messages
  const activeMessages = state.chatMessages.filter((m) => m.memberId === selectedMemberId);

  // Scroll to bottom on message change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Mark as read when active conversation is opened
  useEffect(() => {
    if (!selectedMemberId) return;

    const hasUnread = isMember
      ? activeMessages.some((m) => m.senderType === 'admin' && !m.isReadByMember)
      : activeMessages.some((m) => m.senderType === 'member' && !m.isReadByAdmin);

    if (hasUnread) {
      updateState((prev) => ({
        ...prev,
        chatMessages: prev.chatMessages.map((m) => {
          if (m.memberId === selectedMemberId) {
            return {
              ...m,
              isReadByAdmin: isMember ? m.isReadByAdmin : true,
              isReadByMember: isMember ? true : m.isReadByMember,
            };
          }
          return m;
        }),
      }));
    }
  }, [selectedMemberId, activeMessages.length, isMember]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPesan.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      memberId: selectedMemberId,
      senderType: isMember ? 'member' : 'admin',
      senderNama: isMember ? currentMember.nama : currentAdmin?.nama || 'Pengurus',
      pesan: inputPesan.trim(),
      timestamp: new Date().toISOString(),
      isReadByAdmin: !isMember,
      isReadByMember: isMember,
    };

    setInputPesan('');

    // Also notify server endpoint
    try {
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMsg }),
      });
    } catch {}

    await updateState((prev) => ({
      ...prev,
      chatMessages: [...prev.chatMessages, newMsg],
    }));
  };

  // Download Chat Transcript
  const handleDownloadTranscript = () => {
    if (!activeMember) return;
    const rows = activeMessages.map((m) => ({
      Waktu: m.timestamp.replace('T', ' ').slice(0, 19),
      Pengirim: m.senderNama,
      Tipe: m.senderType.toUpperCase(),
      Pesan: m.pesan,
    }));
    downloadExcelCsv(rows, `Transcript_Chat_${activeMember.nama.replace(/\s+/g, '_')}_${Date.now()}`);
  };

  return (
    <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[75vh] max-h-[700px]">
      {/* ================= LEFT / TOP: CONVERSATION LIST (ADMIN ONLY) ================= */}
      {!isMember && (
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-700/80 bg-[#0d1424] flex flex-col shrink-0">
          <div className="p-3.5 border-b border-slate-700 flex justify-between items-center">
            <span className="text-xs font-black text-white uppercase tracking-wider">
              Chat Anggota (20 Hari)
            </span>
            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
              {state.members.length} Kontak
            </span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60">
            {memberListWithLastMsg.map(({ member, lastMsg, unreadCount }) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={`w-full p-3 text-left flex items-center gap-3 transition-colors ${
                  selectedMemberId === member.id
                    ? 'bg-slate-800/90 border-l-4 border-amber-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  {member.nama.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-white truncate">{member.nama}</span>
                    {lastMsg && (
                      <span className="text-[9px] text-slate-500 font-mono shrink-0">
                        {lastMsg.timestamp.slice(11, 16)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-[11px] text-slate-400 truncate pr-2">
                      {lastMsg ? lastMsg.pesan : 'Belum ada pesan'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center justify-center shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {memberListWithLastMsg.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                Belum ada anggota terdaftar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= RIGHT / MAIN: CHAT CONVERSATION WINDOW ================= */}
      <div className="flex-1 flex flex-col bg-[#0b1120] relative">
        {/* Chat Header */}
        <div className="p-3.5 bg-[#162035] border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center font-bold text-amber-400 text-xs">
                {isMember ? 'HWS' : activeMember?.nama.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                {isMember ? 'Layanan Pengurus Koperasi HWS' : activeMember?.nama}
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[10px] text-slate-400">
                {isMember
                  ? 'Realtime Online • Siap Membantu Transaksi'
                  : `Rek: ${activeMember?.nomorRekening || '-'} • WA: ${activeMember?.whatsapp || '-'}`}
              </div>
            </div>
          </div>

          {!isMember && (
            <button
              onClick={handleDownloadTranscript}
              className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-emerald-500/20"
              title="Unduh Riwayat Chat"
            >
              <Download className="w-3 h-3" />
              Unduh Chat
            </button>
          )}
        </div>

        {/* Message Bubble List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-center my-2">
            <span className="text-[9px] bg-slate-800/80 text-slate-400 px-3 py-1 rounded-full border border-slate-700">
              Pesan tersimpan otomatis 20 hari • Percakapan terenkripsi koperasi
            </span>
          </div>

          {activeMessages.map((msg) => {
            const isMe = isMember ? msg.senderType === 'member' : msg.senderType === 'admin';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                    isMe
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-[#1c273e] text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  <div
                    className={`text-[9px] font-extrabold mb-0.5 ${
                      isMe ? 'text-slate-900' : 'text-amber-400'
                    }`}
                  >
                    {msg.senderNama}
                  </div>
                  <p className="whitespace-pre-line leading-relaxed">{msg.pesan}</p>
                  <div
                    className={`text-[9px] mt-1 text-right flex items-center justify-end gap-1 ${
                      isMe ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp.slice(11, 16)}</span>
                    {isMe && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })}

          {activeMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-amber-500" />
              <p>Belum ada percakapan. Mulai kirim pesan pertanyaan atau bantuan.</p>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} className="p-3 bg-[#162035] border-t border-slate-700 flex gap-2">
          <input
            type="text"
            required
            value={inputPesan}
            onChange={(e) => setInputPesan(e.target.value)}
            placeholder="Ketik pesan Anda..."
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
};
