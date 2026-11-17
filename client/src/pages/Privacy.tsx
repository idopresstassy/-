import { useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { BRAND_LOGO_URL } from "@/lib/brand";

const CONTACT_EMAIL = "tassy@naver.com";

function PolicySection({
  number,
  title,
  id,
  children,
}: {
  number: string;
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-6 first:mt-0">
      <h2 className="mb-3 border-b border-stone-200 pb-2 text-lg font-bold text-stone-900">
        <span className="mr-2 text-amber-700">{number}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-7 text-stone-700">{children}</div>
    </section>
  );
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function Privacy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "개인정보처리방침 | 명작무료책방";
    if (window.location.hash === "#account-deletion") {
      document.getElementById("account-deletion")?.scrollIntoView();
    }
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f5ef] px-4 py-10">
      <article className="mx-auto w-full max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-stone-800">
            <img src={BRAND_LOGO_URL} alt="명작무료책방 로고" className="h-8 w-8 object-contain" />
            명작무료책방
          </Link>
          <Link href="/" className="text-sm text-amber-800 underline">
            첫 화면으로 돌아가기
          </Link>
        </nav>

        <header className="border-b border-stone-200 pb-6">
          <p className="text-xs tracking-[0.2em] text-amber-700">KOREALIB</p>
          <h1 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">개인정보처리방침</h1>
          <p className="mt-3 text-sm text-stone-600">
            서비스명: 명작무료책방 · 운영 주체: 이도 출판(대표 홍기환)
          </p>
          <p className="text-sm text-stone-600">
            웹사이트 https://korealib.com · 안드로이드 앱 com.myeongjak.library
          </p>
          <p className="mt-1 text-sm font-medium text-stone-700">시행일: 2026년 11월 17일</p>
          <a href="#account-deletion" className="mt-4 inline-block text-sm font-medium text-amber-800 underline">
            회원 탈퇴·정보 삭제 요청 안내
          </a>
        </header>

        <div className="mt-8">
          <PolicySection number="1" title="총칙">
            <p>
              이도 출판(이하 “운영자”)은 고전문학·한국문학 무료 전자책 도서관{" "}
              <strong>명작무료책방</strong>(웹사이트 https://korealib.com, 안드로이드 앱
              com.myeongjak.library, 이하 “서비스”)을 운영하며, 「개인정보 보호법」 등 관계 법령에 따라
              이용자의 개인정보를 보호하고, 어떤 정보를 어떤 목적으로 수집·이용하는지 이 방침으로
              알려 드립니다.
            </p>
            <p>
              서비스는 회원가입 없이도 도서를 읽을 수 있습니다. 회원가입은 이메일 주소와 비밀번호만으로
              이루어지며, 회원에게는 읽기 진행도·책갈피·내 책장 저장과 창작 작품 투고 기능이 추가로
              제공됩니다.
            </p>
          </PolicySection>

          <PolicySection number="2" title="수집하는 개인정보 항목과 수집 방법">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-100 text-left text-stone-800">
                    <th className="border border-stone-200 px-3 py-2 font-semibold">구분</th>
                    <th className="border border-stone-200 px-3 py-2 font-semibold">항목</th>
                    <th className="border border-stone-200 px-3 py-2 font-semibold">수집 시점</th>
                  </tr>
                </thead>
                <tbody className="align-top text-stone-700">
                  <tr>
                    <td className="border border-stone-200 px-3 py-2 font-medium">회원가입·로그인</td>
                    <td className="border border-stone-200 px-3 py-2">
                      이메일 주소, 비밀번호, 가입 일시, 최근 로그인 일시, 권한(일반 회원/관리자)
                      <br />
                      <span className="text-stone-500">
                        비밀번호는 인증 서비스(Supabase)가 복원할 수 없는 형태로 암호화하여 보관하며,
                        운영자는 비밀번호 원문을 볼 수 없습니다.
                      </span>
                    </td>
                    <td className="border border-stone-200 px-3 py-2">회원가입, 로그인 시</td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2 font-medium">
                      서비스 이용 기록
                      <br />
                      (로그인 회원)
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      내 책장(담은 도서, 담은 시각), 책갈피(도서, 페이지, 메모, 작성 시각), 읽기
                      진행도(도서, 현재 페이지, 전체 페이지, 갱신 시각)
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      책장·책갈피·읽기 기능을 사용할 때
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2 font-medium">창작 작품 투고</td>
                    <td className="border border-stone-200 px-3 py-2">
                      작품 제목, 필명, 장르, 작품 소개, 본문, 권리 확인 시각, 검수 상태와 검수 메모,
                      게시 여부 변경 기록과 그 사유
                    </td>
                    <td className="border border-stone-200 px-3 py-2">작품을 투고할 때</td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2 font-medium">
                      자동 생성 정보
                      <br />
                      (비로그인 포함)
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      접속 일시, 접속 IP 주소와 브라우저 정보(User-Agent) 일부가 포함된 세션 식별자(방문자 수
                      집계용), 도서 열람 기록(브라우저에 무작위로 만든 식별자, 로그인한 경우 회원
                      계정과 연결)
                    </td>
                    <td className="border border-stone-200 px-3 py-2">서비스에 접속할 때</td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2 font-medium">문의</td>
                    <td className="border border-stone-200 px-3 py-2">
                      문의하신 이메일 주소와 문의 내용
                    </td>
                    <td className="border border-stone-200 px-3 py-2">이메일로 문의할 때</td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2 font-medium">
                      기기에 저장되는 정보
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      로그인 상태 유지 토큰, 로그인한 회원의 표시 정보(이메일·권한) 사본, 화면 테마, 화면 폭 설정,
                      도서관 화면에서 고른 장르·검색어, 방문 집계 중복 방지 표시, 앱
                      설치 안내를 닫은 기록, 뷰어 글자 크기·줄 간격·보기 방식, 오디오 재생 위치
                      <br />
                      <span className="text-stone-500">
                        화면 설정과 오디오 재생 위치는 기기에 저장됩니다. 인증 토큰은 로그인 상태 확인을
                        위해 인증 서비스와 운영자 서버에 전송되며, 이메일·권한 사본의 원본은 서버에서도
                        관리합니다. 방문·열람 집계에 쓰이는 식별자는 위 자동 생성 정보 항목과 같이 전송됩니다.
                      </span>
                    </td>
                    <td className="border border-stone-200 px-3 py-2">서비스 이용 중 자동 저장</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="pt-2">
              <strong>수집하지 않는 정보:</strong> 주민등록번호, 결제 카드 정보(서비스는 결제 기능을
              제공하지 않으며 후원은 계좌 입금만 안내합니다), 위치 정보, 연락처, 사진, 음성, 파일.
              운영자만 도서 표지 이미지와 도서 본문을 등록할 수 있습니다. 서비스는 광고·추적 SDK를
              사용하지 않습니다.
            </p>
          </PolicySection>

          <PolicySection number="3" title="개인정보의 이용 목적">
            <PolicyList
              items={[
                "회원 식별, 로그인 상태 유지, 비밀번호 재설정",
                "읽기 진행도·책갈피·내 책장 저장과 다음 방문 시 복원",
                "창작 작품 접수, 검수, 게시와 그 처리 기록 관리",
                "방문자 수와 인기 도서 집계(개인을 알아볼 수 없는 통계)",
                "서비스 오류 대응과 안정성 확보",
                "문의 응대, 서비스 운영에 필요한 안내 메일 발송",
              ]}
            />
            <p>
              수집한 정보는 위 목적 범위에서만 이용하며, 목적이 달라지는 경우에는 관계 법령에 따라
              필요한 조치를 한 뒤 이용합니다.
            </p>
          </PolicySection>

          <PolicySection number="4" title="개인정보의 보관 기간과 파기">
            <PolicyList
              items={[
                "회원 정보와 이용 기록(책장·책갈피·읽기 진행도): 회원 탈퇴 또는 삭제 요청 시까지",
                "창작 작품과 검수 기록: 게시 중단·삭제 요청 시까지",
                "접속·열람 통계 기록: 수집일로부터 1년",
                "이메일 문의 기록: 처리 완료 후 1년",
              ]}
            />
            <p>
              보관 기간이 끝나거나 목적을 달성한 정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수
              없는 방법으로 삭제하고, 종이 문서가 있는 경우 분쇄합니다. 회원 탈퇴 요청을 처리할 때 프로필, 내
              책장, 책갈피, 읽기 진행도, 투고 원고가 계정과 함께 삭제되며, 방문·열람 기록에서는 회원
              계정과의 연결만 분리됩니다.
            </p>
            <p>
              다만 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따라 보존해야 하는
              기록이 있는 경우에는 해당 법령이 정한 기간 동안 보관한 뒤 파기합니다.
            </p>
          </PolicySection>

          <PolicySection number="5" title="개인정보의 제3자 제공">
            <p>
              운영자는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다음의 경우에만
              제공합니다.
            </p>
            <PolicyList
              items={[
                "이용자가 미리 동의한 경우",
                "법령에 따라 수사기관 등이 적법한 절차로 요청한 경우",
              ]}
            />
          </PolicySection>

          <PolicySection number="6" title="개인정보 처리위탁과 국외 이전">
            <p>
              서비스 운영에 필요한 범위에서 아래 사업자의 서비스를 사용합니다. 사업자 소재지와
              실제 서버 위치는 다를 수 있으며, 해외 서버를 통한 처리에는 국외 이전이 포함됩니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-100 text-left text-stone-800">
                    <th className="border border-stone-200 px-3 py-2 font-semibold">수탁자</th>
                    <th className="border border-stone-200 px-3 py-2 font-semibold">위탁 업무</th>
                    <th className="border border-stone-200 px-3 py-2 font-semibold">
                      이전되는 항목
                    </th>
                    <th className="border border-stone-200 px-3 py-2 font-semibold">사업자 소재지·서버 위치</th>
                  </tr>
                </thead>
                <tbody className="align-top text-stone-700">
                  <tr>
                    <td className="border border-stone-200 px-3 py-2">Supabase Inc.</td>
                    <td className="border border-stone-200 px-3 py-2">
                      회원 인증, 데이터베이스, 파일 저장
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      이메일 주소, 암호화된 비밀번호, 이용 기록, 투고 원고, 도서 표지 이미지
                    </td>
                    <td className="border border-stone-200 px-3 py-2">미국 사업자(프로젝트 데이터베이스: 대한민국 서울)</td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2">Render Services, Inc.</td>
                    <td className="border border-stone-200 px-3 py-2">
                      웹사이트와 서버 호스팅
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      서비스 이용 과정에 발생하는 접속 정보(IP 주소, 브라우저 정보, 접속 일시)
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      미국(서버 위치: 싱가포르)
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-stone-200 px-3 py-2">Google LLC</td>
                    <td className="border border-stone-200 px-3 py-2">
                      오디오 낭독 음성 합성(Google Cloud Text-to-Speech), 도서 본문 문서 불러오기(Google
                      Docs), 웹폰트 제공
                    </td>
                    <td className="border border-stone-200 px-3 py-2">
                      서버에서 전달하는 낭독 대상 도서 본문 문장, Google 문서·웹폰트에 직접 접속할 때의
                      IP 주소와 브라우저 정보. 회원 이메일·비밀번호는 음성 합성 요청에 포함하지 않습니다.
                    </td>
                    <td className="border border-stone-200 px-3 py-2">미국</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              이전 시기와 방법: 이용자가 회원가입, 로그인, 도서 열람, 오디오 낭독 기능을 이용할 때
              인터넷을 통해 전송됩니다. 위탁 업무가 바뀌면 이 방침을 통해 알립니다.
            </p>
          </PolicySection>

          <PolicySection number="7" title="이용자와 법정대리인의 권리와 행사 방법" id="account-deletion">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold text-stone-900">회원 탈퇴·정보 삭제 요청</h3>
              <p className="mt-2">
                가입하신 이메일 주소로 아래 연락처에 탈퇴 또는 삭제를 요청해 주세요.
                운영자가 본인 확인 후 계정과 내 책장·책갈피·읽기 진행도·투고 원고의 삭제 요청을 처리하고
                결과를 알려 드립니다. 비밀번호는 보내지 마세요.
              </p>
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("명작무료책방 회원 탈퇴 및 개인정보 삭제 요청")}`}
                className="mt-3 inline-block font-medium text-amber-900 underline">
                삭제 요청 이메일 보내기: {CONTACT_EMAIL}
              </a>
            </div>
            <PolicyList
              items={[
                "이용자는 언제든지 자신의 개인정보를 조회하거나 정정하고, 삭제 또는 처리 정지를 요청할 수 있습니다.",
                "요청은 이메일(tassy@naver.com)로 하실 수 있으며, 본인 확인 후 지체 없이 처리하고 결과를 알려 드립니다.",
                "회원 탈퇴와 정보 삭제는 위 이메일로 요청하실 수 있습니다. 앱을 삭제하더라도 계정이 자동으로 삭제되지는 않습니다.",
                "비밀번호는 로그인 화면의 ‘비밀번호를 잊으셨나요?’를 통해 등록한 이메일로 재설정할 수 있습니다.",
                "법정대리인이나 위임을 받은 대리인도 같은 방법으로 권리를 행사할 수 있습니다.",
              ]}
            />
          </PolicySection>

          <PolicySection number="8" title="쿠키와 기기 저장소">
            <p>
              운영자는 광고나 이용자 추적을 위한 쿠키를 사용하지 않습니다. 로그인 상태 유지를 위해
              브라우저 저장소(localStorage)에 인증 토큰을 저장하며, 그 밖에 화면 설정과 재생 위치
              같은 편의 정보도 기기에만 저장됩니다.
            </p>
            <p>
              브라우저 설정에서 이 사이트의 저장 데이터를 삭제하면 로그인이 해제되고 저장된 설정이
              초기화됩니다. 서비스 화면에서 로그아웃해도 로그인 토큰이 삭제됩니다.
            </p>
          </PolicySection>

          <PolicySection number="9" title="개인정보의 안전성 확보 조치">
            <PolicyList
              items={[
                "비밀번호는 복원할 수 없는 형태로 암호화하여 저장하며 원문을 보관하지 않습니다.",
                "웹사이트와 앱의 모든 통신 구간을 HTTPS로 암호화합니다.",
                "데이터베이스에 행 수준 접근 제어(RLS)를 적용해 회원은 자신의 기록만 조회·수정할 수 있습니다.",
                "관리자 기능은 운영자 계정으로만 사용할 수 있고, 관리자용 키는 서버에서만 사용합니다.",
              ]}
            />
          </PolicySection>

          <PolicySection number="10" title="만 14세 미만 아동의 개인정보">
            <p>
              서비스는 별도의 연령 확인 절차 없이 이메일로 회원가입을 받습니다. 만 14세 미만 아동은
              법정대리인의 동의 없이 가입하지 않도록 안내하며, 법정대리인의 동의 없이 수집된 사실을
              확인하면 해당 계정과 정보를 지체 없이 삭제합니다.
            </p>
          </PolicySection>

          <PolicySection number="11" title="안드로이드 앱 이용 안내">
            <p>
              안드로이드 앱은 명작무료책방 웹사이트를 표시하고 화면이 꺼진 상태에서도 낭독을 계속하기
              위해 인터넷 접속, 네트워크 상태 확인, 백그라운드 미디어 재생에 필요한 권한만 사용합니다.
              위치, 연락처, 카메라, 마이크 권한은 요청하지 않습니다. 앱에서 수집되는 개인정보는 이
              방침과 같습니다.
            </p>
            <p>
              유튜브, 웹툰 사이트 등 외부 링크로 이동한 경우에는 그 사이트의 개인정보처리방침이
              적용됩니다.
            </p>
          </PolicySection>

          <PolicySection number="12" title="개인정보 보호 책임자와 문의">
            <p>
              개인정보 처리에 관한 문의, 열람·정정·삭제·처리 정지 요청, 불편 사항은 아래로 연락해
              주세요.
            </p>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <p>
                <strong>개인정보 보호 책임자:</strong> 홍기환 (이도 출판 대표)
              </p>
              <p>
                <strong>이메일:</strong>{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-800 underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </PolicySection>

          <PolicySection number="13" title="권익침해 구제 방법">
            <p>
              개인정보 침해로 도움을 받으려면 아래 기관에 상담하거나 신고할 수 있습니다.
            </p>
            <PolicyList
              items={[
                "개인정보침해 신고센터: (국번 없이) 118, privacy.kisa.or.kr",
                "개인정보 분쟁조정위원회: 1833-6972, www.kopico.go.kr",
                "대검찰청 사이버수사과: (국번 없이) 1301, www.spo.go.kr",
                "경찰청: (국번 없이) 182, ecrm.police.go.kr",
              ]}
            />
          </PolicySection>

          <PolicySection number="14" title="방침의 변경">
            <p>
              이 방침의 시행일은 2026년 11월 17일입니다. 내용이 바뀌면 시행 7일 전에 서비스 화면에
              알리고, 이용자 권리에 중대한 변경이 있는 경우에는 30일 전에 알립니다.
            </p>
          </PolicySection>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-6 text-sm text-stone-500">
          <span>© 이도 출판 · 명작무료책방</span>
          <Link href="/" className="text-amber-800 underline">
            첫 화면으로 돌아가기
          </Link>
        </footer>
      </article>
    </main>
  );
}
