"use client";

import * as React from "react";

const ITEMS: { q: string; a: React.ReactNode }[] = [
	{
		q: "Who operates this instance?",
		a: "MST / dhckdgjs operates this self-hosted fork. It is independent of the upstream github-unlisted public service.",
	},
	{
		q: "What does a share link expose?",
		a: "The repository file browser, not just the README. Release notes and downloads are available when enabled. Anyone with the link can access it while it remains valid.",
	},
	{
		q: "What permissions does the GitHub App need?",
		a: "Read-only Contents and Metadata, limited to explicitly selected repositories. The server can read those repositories but cannot write to them.",
	},
	{
		q: "How can access be stopped?",
		a: "Revoke the share in the dashboard, set an expiry, or uninstall the GitHub App in GitHub settings. Copies already downloaded cannot be recalled.",
	},
	{
		q: "Is this an encrypted document vault?",
		a: "No. Repository content passes through GitHub and the hosting service. Keep link URLs private and share only material intended for recipients.",
	},
];

export function FaqAccordion() {
	const [open, setOpen] = React.useState(0);

	return (
		<ul className="faq-list">
			{ITEMS.map((item, i) => {
				const isOpen = open === i;
				const qId = `q-${i + 1}`;
				const aId = `a-${i + 1}`;
				return (
					<li className="faq-item" key={item.q}>
						<button
							type="button"
							className="faq-q"
							aria-expanded={isOpen}
							aria-controls={aId}
							id={qId}
							onClick={() => setOpen(isOpen ? -1 : i)}
						>
							<span className="faq-q__text">{item.q}</span>
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
								<div className="faq-a__body">{item.a}</div>
							</div>
						</section>
					</li>
				);
			})}
		</ul>
	);
}
