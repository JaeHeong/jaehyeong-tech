import Sidebar from '../components/Sidebar'

export default function PrivacyPolicyPage() {
  const lastUpdated = '2025년 1월 6일'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
              <span>Privacy & Legal</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">개인정보처리방침</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              jaehyeong tech 블로그 방문자의 개인정보 보호를 위한 정책입니다.
            </p>
          </div>

          {/* Policy Content Card */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            {/* Card Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center rounded-t-xl">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                최종 수정일: {lastUpdated}
              </span>
              <div className="flex gap-2">
                <div className="size-3 rounded-full bg-red-400/80" />
                <div className="size-3 rounded-full bg-yellow-400/80" />
                <div className="size-3 rounded-full bg-green-400/80" />
              </div>
            </div>

            {/* Policy Content */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <article className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제1조 (총칙)
                </h3>
                <p className="mb-6">
                  jaehyeong tech(이하 "블로그")는 통신비밀보호법, 전기통신사업법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 정보통신서비스제공자가 준수하여야 할 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제2조 (수집하는 개인정보의 항목 및 수집방법)
                </h3>
                <p className="mb-2">
                  1. 본 블로그는 Google OAuth 로그인 서비스를 제공하며, 이 과정에서 다음과 같은 개인정보가 수집됩니다:
                </p>
                <ul className="list-disc pl-5 mb-4 space-y-1">
                  <li>이메일 주소 (Google 계정)</li>
                  <li>이름 (Google 프로필)</li>
                  <li>프로필 사진 URL (Google 프로필, 선택적)</li>
                </ul>
                <p className="mb-2">
                  2. 또한, 이용자가 서비스를 이용하는 과정에서 인터넷 서비스 정보(IP Address, 쿠키, 서비스 이용 기록, 기기 정보, 브라우저 유형 등)가 자동으로 생성되어 수집될 수 있습니다.
                </p>
                <p className="mb-6">
                  3. Google OAuth 로그인을 사용하지 않는 방문자의 경우, 개인을 식별할 수 있는 정보를 직접적으로 수집하지 않습니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제3조 (개인정보의 수집 및 이용목적)
                </h3>
                <p className="mb-2">수집된 개인정보는 다음과 같은 목적으로만 사용됩니다:</p>
                <ul className="list-disc pl-5 mb-6 space-y-1">
                  <li>사용자 인증 및 로그인 상태 유지</li>
                  <li>블로그 관리자 기능 제공 (관리자 계정에 한함)</li>
                  <li>방문자 통계 분석을 통한 콘텐츠 주제 선정 및 서비스 개선</li>
                  <li>서버 성능 모니터링 및 트래픽 관리</li>
                  <li>악성 봇(Bot) 또는 비정상적인 접근 차단 등 보안 유지</li>
                </ul>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제4조 (개인정보의 보유 및 이용 기간)
                </h3>
                <p className="mb-2">
                  1. 회원 탈퇴 시 또는 개인정보 삭제 요청 시 지체 없이 해당 정보를 파기합니다.
                </p>
                <p className="mb-6">
                  2. 단, 관련 법령에 따라 보존할 필요가 있는 경우 해당 법령에서 정한 기간 동안 보관합니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제5조 (개인정보의 제3자 제공)
                </h3>
                <p className="mb-6">
                  블로그는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우에는 예외로 합니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제6조 (쿠키의 운용 및 거부)
                </h3>
                <p className="mb-2">
                  1. 블로그는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다. 쿠키는 웹사이트를 운영하는데 이용되는 서버가 이용자의 브라우저에게 보내는 소량의 정보이며 이용자 컴퓨터의 하드디스크에 저장되기도 합니다.
                </p>
                <p className="mb-6">
                  2. 이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹브라우저 설정을 통해 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 모든 쿠키의 저장을 거부할 수 있습니다. 단, 쿠키 저장을 거부할 경우 로그인이 필요한 일부 서비스 이용에 어려움이 있을 수 있습니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제7조 (Google OAuth 관련 안내)
                </h3>
                <p className="mb-2">
                  1. 본 블로그는 Google OAuth 2.0을 통해 로그인 서비스를 제공합니다.
                </p>
                <p className="mb-2">
                  2. Google 로그인 시 Google의 개인정보처리방침이 적용되며, Google의 개인정보처리방침은{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    여기
                  </a>
                  에서 확인하실 수 있습니다.
                </p>
                <p className="mb-6">
                  3. 이용자는 Google 계정 설정에서 본 블로그에 대한 접근 권한을 언제든지 철회할 수 있습니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제8조 (외부 링크)
                </h3>
                <p className="mb-6">
                  본 블로그는 다른 웹사이트로의 링크를 포함할 수 있습니다. 링크된 외부 웹사이트의 개인정보처리방침은 본 블로그와 무관하므로, 해당 사이트 방문 시에는 별도의 개인정보처리방침을 확인하시기 바랍니다.
                </p>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제9조 (이용자의 권리)
                </h3>
                <p className="mb-2">이용자는 다음과 같은 권리를 행사할 수 있습니다:</p>
                <ul className="list-disc pl-5 mb-6 space-y-1">
                  <li>개인정보 열람 요구</li>
                  <li>개인정보 정정 및 삭제 요구</li>
                  <li>개인정보 처리 정지 요구</li>
                  <li>회원 탈퇴 요청</li>
                </ul>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  제10조 (개인정보 보호책임자)
                </h3>
                <p className="mb-2">
                  블로그 이용 중 발생하는 개인정보보호 관련 민원은 아래의 연락처로 문의해 주시기 바랍니다.
                </p>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  이메일: rlawogud970301@gmail.com
                </p>

                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                  <p>부칙</p>
                  <p>이 방침은 {lastUpdated}부터 시행합니다.</p>
                </div>
              </article>
            </div>
          </div>

          {/* Contact CTA */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800/20 rounded-xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-primary">
                <span className="material-symbols-outlined">shield</span>
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">문의하기</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  개인정보 처리와 관련된 궁금한 점이 있으신가요?
                </p>
              </div>
            </div>
            <a
              href="mailto:rlawogud970301@gmail.com"
              className="w-full sm:w-auto px-6 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-all text-center"
            >
              이메일 보내기
            </a>
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  )
}
