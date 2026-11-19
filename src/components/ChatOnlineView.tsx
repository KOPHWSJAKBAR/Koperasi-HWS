import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  ChatMessage,
} from '../types';
import { downloadExcelCsv } from '../lib/exportPdf';
import {
  commitLocalStatePatch,
  isChatMessageClearedClient,
  maxIsoTsClient,
  sanitizeForFirestore,
  applyRealtimeChatMessages,
  handleFirestoreError,
  OperationType,
  sortMembersDesc,
} from '../lib/storage';
import {
  MessageSquare,
  Send,
  Download,
  CheckCheck,
  Paperclip,
  ArrowLeft,
  X,
  Search,
  FileSpreadsheet,
  FileText,
  Clock,
  ChevronDown,
  Sparkles,
  Trash2,
  Eraser,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ChatOnlineViewProps {
  state: AppState;
  updateState?: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin?: AdminUser;
  currentMember?: MemberUser;
}

export const ChatOnlineView: React.FC<ChatOnlineViewProps> = ({
  state,
  currentAdmin,
  currentMember,
}) => {
  const isMember = !!currentMember;
  const canManageChat =
    !isMember && !!currentAdmin && currentAdmin.role !== 'admin_laporan';

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    isMember ? currentMember.id : sortMembersDesc(state.members)[0]?.id || ''
  );

  useEffect(() => {
    if (isMember && currentMember?.id) {
      setSelectedMemberId(currentMember.id);
    }
  }, [isMember, currentMember?.id]);

  const [mobileChatOpen, setMobileChatOpen] = useState(isMember ? true : false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [inputPesan, setInputPesan] = useState('');
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [lampiranUrl, setLampiranUrl] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmClearModal, setConfirmClearModal] = useState<
    | { mode: 'single_msg'; msg: ChatMessage }
    | { mode: 'member'; member: MemberUser }
    | { mode: 'all' }
    | null
  >(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Keep latest deletion/clear state accessible inside onSnapshot listener
  const clearFilterRef = useRef({
    deletedChatIds: state.deletedChatIds || [],
    chatClearedAt: state.chatClearedAt,
    chatClearedBeforeByMember: state.chatClearedBeforeByMember,
  });
  useEffect(() => {
    clearFilterRef.current = {
      deletedChatIds: state.deletedChatIds || [],
      chatClearedAt: state.chatClearedAt,
      chatClearedBeforeByMember: state.chatClearedBeforeByMember,
    };
  }, [state.deletedChatIds, state.chatClearedAt, state.chatClearedBeforeByMember]);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = setTimeout(() => setStatusBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  // Quick Questions for Members
  const QUICK_PROMPTS = [
    'Mohon bantu verifikasi setoran saya',
    'Bagaimana cara pembayaran setor via QRIS resmi?',
    'Bagaimana cara permohonan buka kunci simpanan pokok?',
    'Apakah jam operasional layanan pengurus hari ini?',
  ];

  // Auto select first member for admin if none selected
  useEffect(() => {
    if (!isMember) {
      if (!selectedMemberId || !state.members.some((m) => m.id === selectedMemberId)) {
        const sortedMembers = sortMembersDesc(state.members);
        if (sortedMembers.length > 0) {
          setSelectedMemberId(sortedMembers[0].id);
        }
      }
    }
  }, [isMember, selectedMemberId, state.members]);

  const handleUploadLampiran = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatusBanner({
        type: 'error',
        message: 'Hanya berkas gambar (JPG, PNG, WEBP) yang didukung untuk lampiran chat.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLampiranUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Online Presence Polling (optimized interval 15s)
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch('/api/presence');
        if (res.ok) {
          const data = await res.json();
          if (data.onlineUsers && Array.isArray(data.onlineUsers)) {
            const ids = new Set<string>(data.onlineUsers.map((u: any) => String(u.userId)));
            setOnlineUserIds(ids);
          }
        }
      } catch {}
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 15000);
    return () => clearInterval(interval);
  }, []);

  // Dedicated Direct Firestore Realtime Online Chat Listener (Zero Delay Sync, respects tombstones)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let active = true;

    import('../lib/firebase').then(({ db }) => {
      if (!active) return;
      import('firebase/firestore').then(({ collection, onSnapshot, query, limit }) => {
        if (!active) return;
        try {
          const q = query(collection(db, 'chats'), limit(500));
          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (snapshot.empty && snapshot.metadata.hasPendingWrites === false) return;
              const delSet = new Set<string>(clearFilterRef.current.deletedChatIds);
              const incoming: ChatMessage[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as ChatMessage;
                if (
                  data &&
                  data.id &&
                  data.memberId &&
                  !isChatMessageClearedClient(
                    data,
                    delSet,
                    clearFilterRef.current.chatClearedAt,
                    clearFilterRef.current.chatClearedBeforeByMember
                  )
                ) {
                  incoming.push(data);
                }
              });

              if (incoming.length > 0) {
                applyRealtimeChatMessages(incoming);
              }
            },
            (err) => {
              handleFirestoreError(err, OperationType.LIST, 'chats');
            }
          );
        } catch (e) {
          console.warn('Failed to attach realtime chat onSnapshot:', e);
        }
      });
    });

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const delChatSet = useMemo(
    () => new Set<string>(state.deletedChatIds || []),
    [state.deletedChatIds]
  );

  const visibleAllMessages = useMemo(() => {
    return (state.chatMessages || []).filter(
      (m) =>
        m &&
        !isChatMessageClearedClient(
          m,
          delChatSet,
          state.chatClearedAt,
          state.chatClearedBeforeByMember
        )
    );
  }, [
    state.chatMessages,
    delChatSet,
    state.chatClearedAt,
    state.chatClearedBeforeByMember,
  ]);

  // Filter members based on search query (diurutkan dari no anggota terbesar ke terkecil)
  const filteredMembers = sortMembersDesc(state.members).filter((mem) => {
    if (!searchMemberQuery.trim()) return true;
    const q = searchMemberQuery.toLowerCase();
    return (
      mem.nama.toLowerCase().includes(q) ||
      (mem.nomorAnggota && mem.nomorAnggota.toLowerCase().includes(q)) ||
      (mem.nomorRekening && mem.nomorRekening.toLowerCase().includes(q)) ||
      (mem.whatsapp && mem.whatsapp.includes(q))
    );
  });

  // Group messages by member & track online status
  const memberListWithLastMsg = filteredMembers.map((mem) => {
    const memMsgs = visibleAllMessages.filter((m) => m.memberId === mem.id);
    const lastMsg = memMsgs[memMsgs.length - 1];
    const unreadCount = memMsgs.filter(
      (m) => m.senderType === 'member' && !m.isReadByAdmin
    ).length;
    const isOnline = onlineUserIds.has(mem.id);
    return {
      member: mem,
      lastMsg,
      unreadCount,
      isOnline,
      lastTimestamp: lastMsg ? new Date(lastMsg.timestamp).getTime() : 0,
    };
  });

  // Sort: online and latest messages first
  memberListWithLastMsg.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return b.lastTimestamp - a.lastTimestamp;
  });

  // Active member object
  const targetMemberId = isMember ? currentMember?.id || selectedMemberId : selectedMemberId;
  const activeMember = isMember
    ? currentMember || state.members.find((m) => m.id === targetMemberId)
    : state.members.find((m) => m.id === targetMemberId);

  // Current active conversation messages (strictly 10 days retention)
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const activeMessages = visibleAllMessages.filter((m) => {
    if (m.memberId !== targetMemberId) return false;
    const time = new Date(m.timestamp).getTime();
    return !isNaN(time) ? now - time <= TEN_DAYS_MS : true;
  });

  // Scroll to bottom on message change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Mark as read when active conversation is opened
  useEffect(() => {
    if (!targetMemberId) return;

    const hasUnread = isMember
      ? activeMessages.some((m) => m.senderType === 'admin' && !m.isReadByMember)
      : activeMessages.some((m) => m.senderType === 'member' && !m.isReadByAdmin);

    if (hasUnread) {
      try {
        fetch('/api/chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: targetMemberId,
            readBy: isMember ? 'member' : 'admin',
          }),
        }).catch(() => {});
      } catch {}

      try {
        import('../lib/firebase').then(({ db }) => {
          import('firebase/firestore').then(({ doc, updateDoc }) => {
            activeMessages.forEach((m) => {
              const shouldUpdate = isMember
                ? m.senderType === 'admin' && !m.isReadByMember
                : m.senderType === 'member' && !m.isReadByAdmin;
              if (shouldUpdate && m.id) {
                updateDoc(doc(db, 'chats', m.id), {
                  isReadByAdmin: isMember ? m.isReadByAdmin : true,
                  isReadByMember: isMember ? true : m.isReadByMember,
                }).catch(() => {});
              }
            });
          });
        });
      } catch {}

      commitLocalStatePatch((prev) => ({
        ...prev,
        chatMessages: prev.chatMessages.map((m) => {
          if (m.memberId === targetMemberId) {
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
  }, [targetMemberId, activeMessages.length, isMember]);

  // Send message (targeted endpoint + local patch, zero 5MB POST /api/state)
  const handleSendMessage = async (textToSend?: string) => {
    const msgText = (textToSend || inputPesan).trim();
    if (!msgText && !lampiranUrl) return;

    const convMemberId = isMember ? currentMember?.id || selectedMemberId : selectedMemberId;
    if (!convMemberId) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      memberId: convMemberId,
      senderType: isMember ? 'member' : 'admin',
      senderNama: isMember ? currentMember.nama : currentAdmin?.nama || 'Pengurus',
      pesan: msgText || (lampiranUrl ? '📷 [Lampiran Gambar]' : ''),
      ...(lampiranUrl ? { lampiranUrl } : {}),
      timestamp: new Date().toISOString(),
      isReadByAdmin: !isMember,
      isReadByMember: isMember,
    };

    setInputPesan('');
    setLampiranUrl('');

    // 1. Direct Firestore setDoc for immediate zero-delay cross-device sync
    try {
      const { db } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const cleanDoc = sanitizeForFirestore(newMsg);
      await setDoc(doc(db, 'chats', newMsg.id), cleanDoc);
    } catch (e) {
      console.warn('Direct Firestore chat error:', e);
    }

    // 2. Notify lightweight server endpoint
    try {
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMsg }),
      }).catch(() => {});
    } catch {}

    // 3. Instant local patch
    commitLocalStatePatch((prev) => ({
      ...prev,
      chatMessages: [
        ...(prev.chatMessages || []).filter((m) => m.id !== newMsg.id),
        newMsg,
      ],
    }));
  };

  // Mark all chat messages as read
  const handleMarkAllChatRead = async () => {
    try {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markAll: true,
          readBy: isMember ? 'member' : 'admin',
          memberId: isMember ? currentMember.id : undefined,
        }),
      });
    } catch {}

    commitLocalStatePatch((prev) => ({
      ...prev,
      chatMessages: prev.chatMessages.map((m) => ({
        ...m,
        isReadByAdmin: isMember ? m.isReadByAdmin : true,
        isReadByMember: isMember
          ? m.memberId === currentMember.id
            ? true
            : m.isReadByMember
          : m.isReadByMember,
      })),
    }));
  };

  // Delete single chat message (Admin)
  const executeDeleteSingleMessage = async (msg: ChatMessage) => {
    if (!canManageChat || !currentAdmin || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/chat/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          adminId: currentAdmin.id,
          adminName: currentAdmin.nama,
          adminRole: currentAdmin.role,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusBanner({
          type: 'error',
          message: resJson?.error || 'Gagal menghapus pesan chat.',
        });
        return;
      }

      try {
        const { db } = await import('../lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'chats', msg.id)).catch(() => {});
      } catch {}

      commitLocalStatePatch((prev) => ({
        ...prev,
        chatMessages: (prev.chatMessages || []).filter((m) => m.id !== msg.id),
        deletedChatIds: Array.from(
          new Set([...(prev.deletedChatIds || []), msg.id])
        ).slice(-2000),
      }));

      setConfirmClearModal(null);
      setStatusBanner({
        type: 'success',
        message: 'Pesan chat berhasil dihapus permanen di semua perangkat.',
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Gagal menghapus pesan chat.',
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Clear chat for selected member or all members (Admin)
  const executeClearChat = async (mode: 'member' | 'all', member?: MemberUser) => {
    if (!canManageChat || !currentAdmin || isProcessingAction) return;
    if (mode === 'member' && !member) return;

    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: mode === 'member' ? member!.id : undefined,
          clearAll: mode === 'all',
          adminId: currentAdmin.id,
          adminName: currentAdmin.nama,
          adminRole: currentAdmin.role,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusBanner({
          type: 'error',
          message: resJson?.error || 'Gagal membersihkan riwayat chat.',
        });
        return;
      }

      const clearedAt = resJson.clearedAt || new Date().toISOString();

      // Mirror deletion to Firestore client-side as well
      try {
        const { db } = await import('../lib/firebase');
        const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'chats')).catch(() => null);
        if (snap) {
          const toDelete = snap.docs.filter((d) => {
            if (mode === 'all') return true;
            const data = d.data() as Partial<ChatMessage>;
            return data?.memberId === member?.id;
          });
          await Promise.all(
            toDelete.map((d) => deleteDoc(doc(db, 'chats', d.id)).catch(() => {}))
          );
        }
      } catch {}

      commitLocalStatePatch((prev) => {
        const delSet = new Set<string>(prev.deletedChatIds || []);
        const nextMessages = (prev.chatMessages || []).filter((m) => {
          const shouldRemove = mode === 'all' || m.memberId === member?.id;
          if (shouldRemove && m.id) delSet.add(m.id);
          return !shouldRemove;
        });

        return {
          ...prev,
          chatMessages: nextMessages,
          deletedChatIds: Array.from(delSet).slice(-2000),
          chatClearedAt:
            mode === 'all' ? maxIsoTsClient(prev.chatClearedAt, clearedAt) : prev.chatClearedAt,
          chatClearedBeforeByMember:
            mode === 'all'
              ? {}
              : {
                  ...(prev.chatClearedBeforeByMember || {}),
                  [member!.id]: maxIsoTsClient(
                    prev.chatClearedBeforeByMember?.[member!.id],
                    clearedAt
                  ),
                },
        };
      });

      setConfirmClearModal(null);
      setShowClearMenu(false);
      setStatusBanner({
        type: 'success',
        message:
          mode === 'all'
            ? 'Seluruh riwayat chat online berhasil dibersihkan secara permanen.'
            : `Riwayat chat ${member?.nama} berhasil dibersihkan secara permanen.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Gagal melakukan clear chat.',
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Download Chat Transcript of Current Member
  const handleDownloadCurrentTranscript = () => {
    if (!activeMember) return;
    const rows = activeMessages.map((m) => ({
      Waktu: m.timestamp.replace('T', ' ').slice(0, 19),
      'ID Anggota': activeMember.id,
      'Nama Anggota': activeMember.nama,
      'No Rekening': activeMember.nomorRekening || '-',
      Pengirim: m.senderNama,
      Tipe: m.senderType.toUpperCase(),
      Pesan: m.pesan,
      Lampiran: m.lampiranUrl ? 'Ada Foto' : 'Tidak Ada',
    }));
    downloadExcelCsv(
      rows,
      `Transcript_Chat_${activeMember.nama.replace(/\s+/g, '_')}_10Hari_${Date.now()}`
    );
    setShowDownloadMenu(false);
  };

  // Download All Chat Messages across All Members (10 Days Retention)
  const handleDownloadAllChatHistory = () => {
    const memberMap = new Map(state.members.map((m) => [m.id, m]));
    const cutoff = Date.now() - TEN_DAYS_MS;
    const allRecentMessages = visibleAllMessages.filter((m) => {
      const t = new Date(m.timestamp).getTime();
      return !isNaN(t) ? t >= cutoff : false;
    });

    const rows = allRecentMessages.map((m) => {
      const mem = memberMap.get(m.memberId);
      return {
        Waktu: m.timestamp.replace('T', ' ').slice(0, 19),
        'ID Anggota': m.memberId,
        'Nama Anggota': mem?.nama || m.senderNama || 'Anggota',
        'No Rekening': mem?.nomorRekening || '-',
        Wilayah: mem?.wilayah || '-',
        Pengirim: m.senderNama,
        'Tipe Pengirim': m.senderType.toUpperCase(),
        Pesan: m.pesan,
        Lampiran: m.lampiranUrl ? 'Ada Berkas Foto' : 'Tidak Ada',
      };
    });

    downloadExcelCsv(rows, `Riwayat_Chat_Seluruh_Anggota_10Hari_${Date.now()}`);
    setShowDownloadMenu(false);
  };

  // Download Raw JSON Archive of Chat History
  const handleDownloadJsonArchive = () => {
    const cutoff = Date.now() - TEN_DAYS_MS;
    const recentMessages = visibleAllMessages.filter((m) => {
      const t = new Date(m.timestamp).getTime();
      return !isNaN(t) ? t >= cutoff : false;
    });

    const exportPayload = {
      title: 'Arsip Riwayat Chat Koperasi HWS (10 Hari)',
      exportedAt: new Date().toISOString(),
      exportedBy: currentAdmin?.nama || 'Super Admin',
      totalMessages: recentMessages.length,
      retentionPolicy: 'Tersimpan Maksimal 10 Hari Kalender (Realtime Online)',
      messages: recentMessages,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Arsip_Chat_Koperasi_HWS_10Hari_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  return (
    <div className="bg-[#111c33] border border-slate-700/80 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[calc(100dvh-130px)] sm:h-[calc(100dvh-150px)] md:h-[680px] lg:h-[720px] max-h-[calc(100dvh-100px)] min-h-[420px]">
      {/* ================= LEFT / TOP: CONVERSATION LIST (ADMIN ONLY) ================= */}
      {!isMember && (
        <div
          className={`w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-700/80 bg-[#0d1424] flex flex-col shrink-0 min-h-0 ${
            mobileChatOpen ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-700/80 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Chat Anggota (10 Hari)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {memberListWithLastMsg.filter((m) => m.isOnline).length} Online
                </span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {state.members.length} Kontak
                </span>
              </div>
            </div>

            {/* Member Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchMemberQuery}
                onChange={(e) => setSearchMemberQuery(e.target.value)}
                placeholder="Cari anggota / rekening / WA..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {searchMemberQuery && (
                <button
                  type="button"
                  onClick={() => setSearchMemberQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Member List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60">
            {memberListWithLastMsg.map(({ member, lastMsg, unreadCount, isOnline }) => (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setSelectedMemberId(member.id);
                  setMobileChatOpen(true);
                }}
                className={`w-full p-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  selectedMemberId === member.id
                    ? 'bg-slate-800/90 border-l-4 border-amber-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                    {member.nama.charAt(0).toUpperCase()}
                  </div>
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0d1424]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-white truncate">{member.nama}</span>
                      {isOnline && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black border border-emerald-500/30 flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </span>
                      )}
                    </div>
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
                {searchMemberQuery ? 'Anggota tidak ditemukan.' : 'Belum ada anggota terdaftar.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= RIGHT / MAIN: CHAT CONVERSATION WINDOW ================= */}
      <div
        className={`flex-1 flex flex-col min-h-0 bg-[#0b1120] relative ${
          !isMember && !mobileChatOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Chat Header */}
        <div className="p-3.5 bg-[#162035] border-b border-slate-700/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {!isMember && (
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="md:hidden py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 shrink-0 shadow-sm cursor-pointer"
                title="Kembali ke Daftar Anggota"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kontak</span>
              </button>
            )}

            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shrink-0">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center font-bold text-amber-400 text-xs">
                {isMember ? 'HWS' : activeMember?.nama.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2 truncate">
                <span className="truncate">
                  {isMember ? 'Layanan Pengurus Koperasi HWS' : activeMember?.nama || 'Pilih Anggota'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    !isMember && activeMember && !onlineUserIds.has(activeMember.id)
                      ? 'bg-slate-500'
                      : 'bg-emerald-400 animate-pulse'
                  }`}
                />
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {isMember ? (
                  <span>Realtime Online • Siap Membantu Transaksi & Verifikasi</span>
                ) : (
                  <span>
                    Rek: {activeMember?.nomorRekening || '-'} • WA: {activeMember?.whatsapp || '-'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleMarkAllChatRead}
              className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all shadow-sm cursor-pointer"
              title="Tandai semua pesan chat sudah dibaca (hilangkan notifikasi)"
            >
              <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Tandai Dibaca</span>
            </button>

            {/* Admin Clear Chat Menu */}
            {canManageChat && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearMenu(!showClearMenu);
                    setShowDownloadMenu(false);
                  }}
                  className="py-1.5 px-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-rose-500/30 transition-all shadow-sm cursor-pointer"
                  title="Hapus atau bersihkan riwayat chat"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Chat</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showClearMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                    <div className="px-2.5 py-1.5 border-b border-slate-800">
                      <span className="text-[10px] uppercase font-black text-rose-400">
                        Opsi Clear Chat Admin
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!activeMember || activeMessages.length === 0}
                      onClick={() => {
                        if (activeMember) {
                          setConfirmClearModal({ mode: 'member', member: activeMember });
                        }
                        setShowClearMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Eraser className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Clear Chat Anggota Ini</div>
                        <div className="text-[10px] text-slate-400">
                          {activeMember?.nama || '-'} ({activeMessages.length} pesan)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={visibleAllMessages.length === 0}
                      onClick={() => {
                        setConfirmClearModal({ mode: 'all' });
                        setShowClearMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-300 hover:bg-rose-500/15 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-rose-200">Clear Semua Chat</div>
                        <div className="text-[10px] text-rose-400/80">
                          Semua anggota ({visibleAllMessages.length} pesan)
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Admin Download Chat Transcript Menu */}
            {!isMember && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDownloadMenu(!showDownloadMenu);
                    setShowClearMenu(false);
                  }}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 transition-all shadow-sm cursor-pointer active:scale-95"
                  title="Unduh Riwayat Chat"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unduh Chat</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showDownloadMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                    <div className="px-2.5 py-1.5 border-b border-slate-800">
                      <span className="text-[10px] uppercase font-black text-amber-400">
                        Opsi Unduh Riwayat Chat (10 Hari)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadCurrentTranscript}
                      disabled={!activeMember}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Chat Anggota Terpilih</div>
                        <div className="text-[10px] text-slate-400">
                          {activeMember?.nama || '-'} (Excel / CSV)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadAllChatHistory}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Seluruh Percakapan (10 Hari)</div>
                        <div className="text-[10px] text-slate-400">
                          Semua anggota koperasi (Excel / CSV)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadJsonArchive}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Cadangan Arsip JSON</div>
                        <div className="text-[10px] text-slate-400">
                          Penyimpanan audit & arsip 10 hari
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusBanner && (
          <div
            className={`mx-3 mt-2 px-3 py-2 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-2 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Bubble List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 overscroll-contain">
          {/* 10-Day Retention Notice */}
          <div className="text-center my-1.5">
            <span className="text-[10px] bg-slate-800/80 text-slate-300 px-3.5 py-1.5 rounded-full border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>
                Riwayat chat tersimpan <strong>10 hari</strong> & tersinkronisasi realtime ke semua
                perangkat.
              </span>
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
                  className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md group relative ${
                    isMe
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-[#1c273e] text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-0.5">
                    <span
                      className={`text-[9px] font-extrabold ${
                        isMe ? 'text-slate-900' : 'text-amber-400'
                      }`}
                    >
                      {msg.senderNama}
                    </span>
                    {canManageChat && (
                      <button
                        type="button"
                        onClick={() => setConfirmClearModal({ mode: 'single_msg', msg })}
                        className={`p-0.5 rounded transition-opacity cursor-pointer ${
                          isMe
                            ? 'text-slate-800/70 hover:text-rose-700'
                            : 'text-slate-400 hover:text-rose-400'
                        }`}
                        title="Hapus pesan ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-line leading-relaxed">{msg.pesan}</p>
                  {msg.lampiranUrl && (
                    <div
                      className="mt-1.5 mb-1 max-w-[200px] rounded-xl overflow-hidden cursor-pointer border border-slate-700/60 shadow hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewImage(msg.lampiranUrl!)}
                    >
                      <img
                        src={msg.lampiranUrl}
                        alt="Lampiran Foto"
                        className="w-full max-h-40 object-cover"
                      />
                    </div>
                  )}
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
            <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-slate-500 text-xs">
              <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-amber-500" />
              <p>Belum ada percakapan. Mulai kirim pesan pertanyaan atau bantuan.</p>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Chips for Member */}
        {isMember && (
          <div className="px-3 py-1.5 bg-[#0f172a] border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
            <span className="text-[10px] text-amber-400 font-bold shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Cepat:
            </span>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shrink-0 whitespace-nowrap transition-colors cursor-pointer text-[10px]"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Attachment preview banner */}
        {lampiranUrl && (
          <div className="px-3 py-1.5 bg-[#141d30] border-t border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <img
                src={lampiranUrl}
                alt="Pratinjau"
                className="w-9 h-9 object-cover rounded-lg border border-amber-500/40"
              />
              <span className="text-[11px] text-amber-300 font-bold">1 Lampiran Foto Terpilih</span>
            </div>
            <button
              type="button"
              onClick={() => setLampiranUrl('')}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Message Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-2 sm:p-3 bg-[#162035] border-t border-slate-700/80 flex items-center gap-2 shrink-0 sticky bottom-0 z-20 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
        >
          <label
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition-colors flex items-center justify-center shrink-0 border border-slate-700"
            title="Kirim Foto / Lampiran"
          >
            <Paperclip className="w-4 h-4 text-amber-400" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadLampiran(f);
              }}
              className="hidden"
            />
          </label>
          <input
            type="text"
            value={inputPesan}
            onChange={(e) => setInputPesan(e.target.value)}
            onFocus={() => {
              setTimeout(() => {
                chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 250);
            }}
            placeholder={
              isMember
                ? 'Ketik pertanyaan untuk pengurus koperasi...'
                : `Ketik balasan untuk ${activeMember?.nama || 'anggota'}...`
            }
            className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-base sm:text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 min-w-0"
          />
          <button
            type="submit"
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0 cursor-pointer transition-transform"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Kirim</span>
          </button>
        </form>

        {/* Image Preview Modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-2xl max-h-[85vh] bg-[#0f172a] rounded-2xl overflow-hidden border border-slate-700 p-2 shadow-2xl">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/70 hover:bg-black rounded-full text-white cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewImage}
                alt="Lampiran Penuh"
                className="max-w-full max-h-[80vh] object-contain rounded-xl mx-auto"
              />
            </div>
          </div>
        )}

        {/* Confirmation Modal for Delete Single Message / Clear Chat */}
        {confirmClearModal && canManageChat && (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-rose-500/40 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-white">
                    {confirmClearModal.mode === 'single_msg'
                      ? 'Hapus Pesan Chat Ini?'
                      : confirmClearModal.mode === 'member'
                      ? `Clear Chat ${confirmClearModal.member.nama}?`
                      : 'Clear Semua Riwayat Chat Online?'}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {confirmClearModal.mode === 'single_msg'
                      ? `Pesan "${confirmClearModal.msg.pesan.slice(0, 80)}${
                          confirmClearModal.msg.pesan.length > 80 ? '...' : ''
                        }" akan dihapus permanen di semua perangkat.`
                      : confirmClearModal.mode === 'member'
                      ? `Seluruh pesan percakapan dengan ${confirmClearModal.member.nama} akan dibersihkan secara permanen dari server, Cloud Firestore, dan semua perangkat.`
                      : 'Seluruh riwayat percakapan chat online untuk semua anggota akan dibersihkan secara permanen di semua perangkat.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => setConfirmClearModal(null)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => {
                    if (confirmClearModal.mode === 'single_msg') {
                      executeDeleteSingleMessage(confirmClearModal.msg);
                    } else if (confirmClearModal.mode === 'member') {
                      executeClearChat('member', confirmClearModal.member);
                    } else {
                      executeClearChat('all');
                    }
                  }}
                  className="py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isProcessingAction ? 'Memproses...' : 'Ya, Hapus Permanen'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
