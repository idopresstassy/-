'use client';

import { useState } from 'react';
import { Book } from '@/lib/books';
import { useBooks } from '@/lib/useBooks';
import { useDonation, DonationInfo } from '@/lib/useDonation';
import { useAuth } from '@/lib/AuthContext';
import { Save, Plus, Trash2, Loader2, Youtube, ArrowLeft, ShieldX, Heart } from 'lucide-react';
import Link from 'next/link';

const GENRES = ['고전', '현대', '해외'] as const;

export default function AdminPage() {
  const { books, isLoaded, saveBook, deleteBook } = useBooks();
  const { donation, isLoaded: donationLoaded, saveDonation } = useDonation();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Book>>({});
  const [saving, setSaving] = useState(false);

  // 후원 정보 편집 상태
  const [editingDonation, setEditingDonation] = useState(false);
  const [donationForm, setDonationForm] = useState<DonationInfo>(donation);
  const [savingDonation, setSavingDonation] = useState(false);

  const handleEdit = (book: Book) => {
    setEditingId(book.id);
    setEditForm(book);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await saveBook({ ...editForm, id: editingId });
      setEditingId(null);
      setEditForm({});
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다. 관리자 권한을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteBook(id);
    } catch (e) {
      console.error(e);
      alert('삭제에 실패했습니다. 관리자 권한을 확인해주세요.');
    }
  };

  const handleAddNew = async () => {
    const newBook: Partial<Book> = {
      title: '새 도서',
      author: '',
      genre: '현대',
      content: '',
    };
    setSaving(true);
    try {
      await saveBook(newBook);
    } catch (e) {
      console.error(e);
      alert('추가에 실패했습니다. 관리자 권한을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditDonation = () => {
    setDonationForm(donation);
    setEditingDonation(true);
  };

  const handleSaveDonation = async () => {
    setSavingDonation(true);
    try {
      await saveDonation(donationForm);
      setEditingDonation(false);
    } catch (e) {
      console.error(e);
      alert('후원 정보 저장에 실패했습니다. 관리자 권한을 확인해주세요.');
    } finally {
      setSavingDonation(false);
    }
  };

  if (authLoading || !isLoaded || !donationLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <ShieldX className="w-16 h-16 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-900">접근 권한이 없습니다</h1>
        <p className="text-gray-500 text-sm">관리자 계정으로 로그인해주세요.</p>
        <Link href="/" className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">관리자 페이지</h1>
          </div>
          <button
            onClick={handleAddNew}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            도서 추가
          </button>
        </header>

        {/* 후원 정보 관리 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-gray-900">후원 안내 관리</h2>
            </div>
            {!editingDonation && (
              <button
                onClick={handleEditDonation}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium transition-colors"
              >
                수정
              </button>
            )}
          </div>

          <div className="p-6">
            {editingDonation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">은행명</label>
                    <input
                      type="text"
                      value={donationForm.bank_name}
                      onChange={(e) => setDonationForm({ ...donationForm, bank_name: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                      placeholder="카카오뱅크"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
                    <input
                      type="text"
                      value={donationForm.account_number}
                      onChange={(e) => setDonationForm({ ...donationForm, account_number: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm font-mono"
                      placeholder="3333-29-8406357"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
                    <input
                      type="text"
                      value={donationForm.account_holder}
                      onChange={(e) => setDonationForm({ ...donationForm, account_holder: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                      placeholder="홍기환"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">후원 안내 문구</label>
                  <textarea
                    value={donationForm.description}
                    onChange={(e) => setDonationForm({ ...donationForm, description: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                    rows={4}
                    placeholder="후원 안내 설명을 입력하세요. 줄바꿈으로 문단을 구분합니다."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">문의 이메일</label>
                    <input
                      type="email"
                      value={donationForm.contact_email}
                      onChange={(e) => setDonationForm({ ...donationForm, contact_email: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                      placeholder="tassy@naver.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">대표자 정보</label>
                    <input
                      type="text"
                      value={donationForm.representative}
                      onChange={(e) => setDonationForm({ ...donationForm, representative: e.target.value })}
                      className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                      placeholder="이도출판 대표 홍기환"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">마무리 인사말</label>
                  <textarea
                    value={donationForm.closing_message}
                    onChange={(e) => setDonationForm({ ...donationForm, closing_message: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                    rows={3}
                    placeholder="감사합니다. 줄바꿈으로 문단을 구분합니다."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">법적 고지</label>
                  <textarea
                    value={donationForm.legal_notice}
                    onChange={(e) => setDonationForm({ ...donationForm, legal_notice: e.target.value })}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                    rows={2}
                    placeholder="법적 고지 문구를 입력하세요."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveDonation}
                    disabled={savingDonation}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingDonation ? '저장 중...' : '저장'}
                  </button>
                  <button
                    onClick={() => setEditingDonation(false)}
                    className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-gray-500">은행명:</span>{' '}
                    <span className="font-medium">{donation.bank_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">계좌번호:</span>{' '}
                    <span className="font-mono font-medium">{donation.account_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">예금주:</span>{' '}
                    <span className="font-medium">{donation.account_holder}</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">안내 문구:</span>{' '}
                  <span className="text-gray-700">{donation.description.substring(0, 80)}...</span>
                </div>
                <div>
                  <span className="text-gray-500">문의:</span>{' '}
                  <span className="text-gray-700">{donation.contact_email}</span>
                </div>
                <div>
                  <span className="text-gray-500">대표자:</span>{' '}
                  <span className="text-gray-700">{donation.representative}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 도서 관리 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-medium text-gray-500">제목 / 작가</th>
                <th className="p-4 font-medium text-gray-500 w-24">장르</th>
                <th className="p-4 font-medium text-gray-500">영상 URL</th>
                <th className="p-4 font-medium text-gray-500 w-32">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50/50">
                  <td className="p-4">
                    {editingId === book.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full p-2 border rounded"
                          placeholder="제목"
                        />
                        <input
                          type="text"
                          value={editForm.author || ''}
                          onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                          className="w-full p-2 border rounded"
                          placeholder="작가"
                        />
                        <textarea
                          value={editForm.content || ''}
                          onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          className="w-full p-2 border rounded text-sm font-mono"
                          placeholder="본문 내용 (줄바꿈으로 문단 구분)"
                          rows={6}
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-gray-900">{book.title}</div>
                        <div className="text-sm text-gray-500">{book.author}</div>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === book.id ? (
                      <select
                        value={editForm.genre || '현대'}
                        onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                      >
                        {GENRES.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                        {book.genre}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === book.id ? (
                      <div className="flex items-center gap-2">
                        <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                        <input
                          type="text"
                          value={editForm.videoUrl || ''}
                          onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
                          className="w-full p-2 border rounded font-mono text-sm"
                          placeholder="YouTube URL"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {book.videoUrl ? (
                          <>
                            <Youtube className="w-4 h-4 text-red-500" />
                            <span className="font-mono truncate max-w-[200px]">{book.videoUrl}</span>
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-xs">미설정</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === book.id ? (
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        저장
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(book)}
                          className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50 text-sm"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(book.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
