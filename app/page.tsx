"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Book } from "@/lib/books";
import { useBooks } from "@/lib/useBooks";
import BookReader from "@/components/BookReader";
import {
  Search,
  BookOpen,
  PlayCircle,
  Settings,
  Loader2,
  X,
} from "lucide-react";

export default function Home() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDonationModal, setShowDonationModal] = useState(false);
  const { books, isLoaded } = useBooks();

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDonationModal(false);
    };
    if (showDonationModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showDonationModal]);

  const filteredBooks = books.filter(
    (book) =>
      book.title.includes(searchTerm) || book.author.includes(searchTerm)
  );

  return (
    <div className="min-h-screen pb-20 bg-[#fdfbf7]">
      {/* Header */}
      <header className="pt-16 pb-8 px-6 text-center border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 relative">
        <Link
          href="/admin"
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
          title="관리자 페이지"
        >
          <Settings className="w-5 h-5" />
        </Link>

        <div className="flex items-center justify-center gap-3 mb-2">
          <Image
            src="/logo.png"
            alt="한국문학도서관 로고"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 font-serif">
            한국문학도서관
          </h1>
        </div>
        <button
          onClick={() => setShowDonationModal(true)}
          className="text-gray-500 text-sm md:text-base mb-6 hover:text-amber-600 transition-colors cursor-pointer"
        >
          한국문화도서관은 여러분의 후원과 구독으로 운영됩니다.
          <span className="text-amber-500 ml-1 underline">(자세히 보기)</span>
        </button>

        {/* Search */}
        <div className="max-w-md mx-auto relative group">
          <input
            type="text"
            placeholder="도서명 또는 작가 검색..."
            className="w-full pl-12 pr-6 py-3 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Book List */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!isLoaded ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col md:flex-row gap-6 items-start md:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900 font-serif">
                        {book.title}
                      </h3>
                      <span className="text-sm text-gray-500 font-medium">
                        {book.author}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 md:line-clamp-none">
                      {book.summary}
                    </p>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto shrink-0">
                    <button
                      onClick={() => setCurrentBook(book)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <BookOpen className="w-4 h-4" />
                      읽기
                    </button>
                    {book.videoUrl && (
                      <a
                        href={book.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium border border-amber-100"
                      >
                        <PlayCircle className="w-4 h-4" />
                        영상
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                검색 결과가 없습니다.
              </div>
            )}
          </>
        )}
      </main>

      {/* Reader Overlay */}
      {currentBook && (
        <BookReader
          title={currentBook.title}
          initialContent={currentBook.content}
          googleDocUrl={currentBook.googleDocUrl}
          onClose={() => setCurrentBook(null)}
        />
      )}

      {/* 후원 안내 모달 */}
      {showDonationModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDonationModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900 font-serif">
                한국문학도서관을 응원해 주세요
              </h2>
              <button
                onClick={() => setShowDonationModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="px-6 py-5 space-y-4 text-gray-700 text-sm leading-relaxed">
              <p>
                무료로 제공되는 이 문학도서관은 개인의 노력으로 운영되고
                있습니다.
              </p>
              <p>
                서버 유지비와 자료 정리를 위한 후원은 자발적으로만 받고 있으며,
                후원금은 사이트 운영 및 한국문학 자료 보존에 사용됩니다.
              </p>
              <p className="text-amber-600 font-medium">
                *후원은 자율적이며, 어떠한 대가나 특별 서비스가 제공되지
                않습니다.
              </p>

              {/* 후원 방법 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                <h3 className="font-bold text-gray-900 mb-3">후원 방법</h3>
                <div className="space-y-1">
                  <p>
                    <span className="text-gray-500">카카오뱅크</span>{" "}
                    <span className="font-mono font-bold">3333-29-8406357</span>
                  </p>
                  <p>
                    <span className="text-gray-500">예금주</span>{" "}
                    <span className="font-bold">홍기환</span>
                  </p>
                </div>
              </div>

              <p className="text-gray-500">
                문의:{" "}
                <a
                  href="mailto:tassy@naver.com"
                  className="text-amber-600 hover:underline"
                >
                  tassy@naver.com
                </a>
              </p>

              <p className="pt-2">
                감사합니다.
                <br />
                여러분의 관심이 한국문학의 지속적인 보존과 확산에 큰 힘이
                됩니다.
              </p>
              <p className="font-medium text-gray-900">이도출판 대표 홍기환</p>

              {/* 도서 목록 */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="font-bold text-gray-900 mb-3">
                  한국문학도서관 목록 (현재 101권)
                </h3>
                <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
                  <p>
                    <strong>심훈</strong>_상록수 / <strong>나도향</strong>_뽕,
                    물레방아, 벙어리삼룡이 / <strong>김동인</strong>_감자,
                    광염소나타, 광화사, 김연실전, 발가락이 닮았다, 배따라기,
                    붉은산, 약한자의 슬픔, 태형 / <strong>강경애</strong>
                    _인간문제, 지하촌 / <strong>김유정</strong>_소낙비, 금따는
                    콩밭, 동백꽃, 만무방, 봄봄 / <strong>현진건</strong>
                    _술권하는사회, B사감과 러브레터, 고향, 불, 빈처, 운수좋은날,
                    할머니의 죽음 / <strong>채만식</strong>_레디메이드인생,
                    논이야기, 치숙, 탁류, 태평천하 / <strong>김남천</strong>
                    _대하, 처를 때리고 / <strong>안국선</strong>_금수회의록 /{" "}
                    <strong>이광수</strong>_꿈, 무정, 소년의비애, 유정, 흙 /{" "}
                    <strong>이상</strong>_날개, 봉별기, 종생기 /{" "}
                    <strong>조명희</strong>_낙동강 / <strong>최서해</strong>
                    _고국, 박돌의죽음, 탈출기, 홍염 / <strong>이효석</strong>
                    _메밀꽃 필 무렵, 도시와 유령, 들, 분녀, 산, 돈, 장미병들다,
                    화분 / <strong>김구</strong>_백범일지 /{" "}
                    <strong>임춘</strong>_공방전 / <strong>임제</strong>
                    _원생몽유록 / <strong>이욱</strong>_부목한전, 심생전 /{" "}
                    <strong>이덕무</strong>_은애전 / <strong>이규보</strong>
                    _청강사자현부전 / <strong>안정복</strong>_여용국전 /{" "}
                    <strong>유몽인</strong>_홍도, 유우춘전 /{" "}
                    <strong>신광한</strong>_안빙몽유록 / <strong>보우</strong>
                    _왕랑반혼전 / <strong>박지원</strong>_호질, 예덕선생전, 열녀
                    함양박씨전, 양반전, 민옹전, 마장전, 김신신전, 허생전,
                    광문자전 / <strong>김시습</strong>_취유부벽정기, 용궁부연록,
                    만복사저포기, 남염부주지, 이생규장전 / <strong>권필</strong>
                    _주생전 / <strong>김만중</strong>_사씨남정기, 구운몽 /{" "}
                    <strong>이곡</strong>_죽부인전 / <strong>작자미상</strong>
                    _흥부전, 심청전, 박문수전, 배비장전, 오유란전, 숙영낭자전,
                    금방울전, 서동지전, 장끼전, 토끼전, 변강쇠가, 옹고집전,
                    이춘풍전, 용부전
                  </p>
                </div>
              </div>

              {/* 법적 고지 */}
              <div className="bg-gray-100 rounded-lg p-3 text-xs text-gray-500 mt-4">
                ※ 본 페이지의 후원금은 「기부금품법」상의 법정 기부금이 아닌,
                운영자 개인에 대한 자발적 후원금으로 세제공제 대상이 아닙니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
