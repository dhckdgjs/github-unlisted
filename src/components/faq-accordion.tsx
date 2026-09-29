"use client";

import * as React from "react";
import { useLocale } from "@/components/locale-provider";

const ITEMS: { q: [string, string]; a: [string, string] }[] = [
	{
		q: ["이 사이트는 누가 운영하나요?", "Who operates this instance?"],
		a: [
			"MST / dhckdgjs가 이 포크를 직접 운영합니다. 원본 github-unlisted 프로젝트의 공개 서비스와는 별개입니다.",
			"MST / dhckdgjs operates this self-hosted fork. It is independent of the upstream github-unlisted public service.",
		],
	},
	{
		q: [
			"공유 링크로 어떤 내용을 볼 수 있나요?",
			"What does a share link expose?",
		],
		a: [
			"README뿐 아니라 저장소의 파일 탐색기를 볼 수 있습니다. 해당 기능이 활성화되어 있으면 릴리스 노트와 다운로드도 이용할 수 있습니다. 링크가 유효한 동안에는 링크를 가진 누구나 접근할 수 있습니다.",
			"The repository file browser, not just the README. Release notes and downloads are available when enabled. Anyone with the link can access it while it remains valid.",
		],
	},
	{
		q: [
			"GitHub App에 어떤 권한이 필요한가요?",
			"What permissions does the GitHub App need?",
		],
		a: [
			"명시적으로 선택한 저장소에 한해 Contents와 Metadata 읽기 전용 권한이 필요합니다. 서버는 해당 저장소를 읽을 수 있지만 수정할 수는 없습니다.",
			"Read-only Contents and Metadata, limited to explicitly selected repositories. The server can read those repositories but cannot write to them.",
		],
	},
	{
		q: ["공유 접근을 중지하려면 어떻게 하나요?", "How can access be stopped?"],
		a: [
			"대시보드에서 공유 링크를 폐기하거나 만료일을 설정하면 됩니다. GitHub 설정에서 GitHub App을 제거할 수도 있습니다. 이미 다운로드한 사본은 회수할 수 없습니다.",
			"Revoke the share in the dashboard, set an expiry, or uninstall the GitHub App in GitHub settings. Copies already downloaded cannot be recalled.",
		],
	},
	{
		q: ["암호화된 문서 보관함인가요?", "Is this an encrypted document vault?"],
		a: [
			"아닙니다. 저장소 콘텐츠는 GitHub와 호스팅 서비스를 거칩니다. 링크 URL을 비공개로 유지하고, 받는 사람에게 보여 주려는 자료만 공유하세요.",
			"No. Repository content passes through GitHub and the hosting service. Keep link URLs private and share only material intended for recipients.",
		],
	},
];

export function FaqAccordion() {
	const { t } = useLocale();
	const [open, setOpen] = React.useState(0);

	return (
		<ul className="faq-list">
			{ITEMS.map((item, i) => {
				const isOpen = open === i;
				const qId = `q-${i + 1}`;
				const aId = `a-${i + 1}`;
				return (
					<li className="faq-item" key={item.q[1]}>
						<button
							type="button"
							className="faq-q"
							aria-expanded={isOpen}
							aria-controls={aId}
							id={qId}
							onClick={() => setOpen(isOpen ? -1 : i)}
						>
							<span className="faq-q__text">{t(...item.q)}</span>
							<span className="faq-q__icon" aria-hidden="true">
								<svg
									viewBox="0 0 12 12"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.6"
									strokeLinecap="round"
								>
									<line x1="6" y1="2" x2="6" y2="10" />
									<line x1="2" y1="6" x2="10" y2="6" />
								</svg>
							</span>
						</button>
						<section className="faq-a" id={aId} aria-labelledby={qId}>
							<div className="faq-a__inner">
								<div className="faq-a__body">{t(...item.a)}</div>
							</div>
						</section>
					</li>
				);
			})}
		</ul>
	);
}
