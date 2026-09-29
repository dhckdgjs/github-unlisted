"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/locale-provider";

type SubjectKey = "problem" | "feature" | "other";
type Status = "idle" | "sending" | "sent" | "error";

const SUBJECTS: { value: SubjectKey; label: string; labelKo: string }[] = [
	{ value: "problem", label: "Reporting a problem", labelKo: "문제 신고" },
	{ value: "feature", label: "Requesting a feature", labelKo: "기능 요청" },
	{ value: "other", label: "Others", labelKo: "기타" },
];

// Keep the server response and submitted values intact; localize presentation only.
const ERROR_KO: Record<string, string> = {
	"Invalid request.": "올바르지 않은 요청입니다.",
	"Please enter your name.": "이름을 입력해 주세요.",
	"Please enter a valid email.": "올바른 이메일 주소를 입력해 주세요.",
	"Please choose a subject.": "문의 유형을 선택해 주세요.",
	"Please specify the subject.": "문의 제목을 입력해 주세요.",
	"Please enter a message.": "문의 내용을 입력해 주세요.",
	"Too many messages. Please try again later.":
		"문의가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
	"Email is not configured.": "이메일 전송이 설정되어 있지 않습니다.",
	"Could not send your message. Please try again.":
		"문의를 전송하지 못했습니다. 다시 시도해 주세요.",
	"Something went wrong. Please try again.":
		"문제가 발생했습니다. 다시 시도해 주세요.",
	"Something went wrong.": "문제가 발생했습니다.",
	"Failed to fetch":
		"서버에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.",
	"Load failed": "서버에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.",
	"NetworkError when attempting to fetch resource.":
		"서버에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.",
};

export function ContactButton({
	className = "nav-contact",
	label,
}: {
	className?: string;
	label?: string;
}) {
	const { t } = useLocale();
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [subject, setSubject] = useState<SubjectKey>("problem");

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (!open) return;
		document.body.dataset.contact = "open";
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			delete document.body.dataset.contact;
		};
	}, [open]);

	function start() {
		setStatus("idle");
		setError(null);
		setSubject("problem");
		setOpen(true);
	}

	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const data = new FormData(form);
		// Honeypot: a real user never fills this; bail silently if a bot did.
		if (String(data.get("company") ?? "").trim() !== "") return;
		setStatus("sending");
		setError(null);
		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: data.get("name"),
					email: data.get("email"),
					subject: data.get("subject"),
					customSubject: data.get("customSubject") ?? "",
					message: data.get("message"),
					company: data.get("company") ?? "",
				}),
			});
			const json = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
			};
			if (!res.ok || !json.ok) {
				throw new Error(
					json.error ?? "Something went wrong. Please try again.",
				);
			}
			form.reset();
			setSubject("problem");
			setStatus("sent");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Something went wrong.");
		}
	}

	const modal = (
		<>
			<button
				type="button"
				className="contact-backdrop"
				aria-label={t("문의 폼 닫기", "Close contact form")}
				onClick={() => setOpen(false)}
			/>
			<div
				className="contact-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="contact-title"
			>
				<div className="contact-modal__head">
					<h2 id="contact-title" className="contact-modal__title">
						{t("문의하기", "Contact")}
					</h2>
					<button
						type="button"
						className="contact-modal__close"
						aria-label={t("닫기", "Close")}
						onClick={() => setOpen(false)}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							aria-hidden="true"
						>
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>

				{status === "sent" ? (
					<div className="contact-sent">
						<p>
							{t(
								"문의가 전송되었습니다. 감사합니다. 가능한 때에 이메일로 답변드리겠습니다.",
								"Thanks, your message has been sent. I'll reply over email when I can.",
							)}
						</p>
						<button
							type="button"
							className="contact-submit"
							onClick={() => setOpen(false)}
						>
							{t("닫기", "Close")}
						</button>
					</div>
				) : (
					<form className="contact-form" onSubmit={onSubmit}>
						<label className="contact-field">
							<span className="contact-label">{t("이름", "Name")}</span>
							<input
								className="contact-input"
								name="name"
								type="text"
								required
								maxLength={100}
								autoComplete="name"
							/>
						</label>
						<label className="contact-field">
							<span className="contact-label">{t("이메일", "Email")}</span>
							<input
								className="contact-input"
								name="email"
								type="email"
								required
								maxLength={200}
								autoComplete="email"
							/>
						</label>
						<label className="contact-field">
							<span className="contact-label">{t("문의 유형", "Subject")}</span>
							<select
								className="contact-input contact-select"
								name="subject"
								value={subject}
								onChange={(e) => setSubject(e.target.value as SubjectKey)}
							>
								{SUBJECTS.map((s) => (
									<option key={s.value} value={s.value}>
										{t(s.labelKo, s.label)}
									</option>
								))}
							</select>
						</label>
						{subject === "other" && (
							<label className="contact-field">
								<span className="contact-label">
									{t("문의 제목", "Specify subject")}
								</span>
								<input
									className="contact-input"
									name="customSubject"
									type="text"
									required
									maxLength={100}
								/>
							</label>
						)}
						<label className="contact-field">
							<span className="contact-label">{t("문의 내용", "Message")}</span>
							<textarea
								className="contact-input contact-textarea"
								name="message"
								required
								maxLength={5000}
								rows={5}
							/>
						</label>
						{/* Honeypot — hidden from users, catches bots. */}
						<input
							className="contact-hp"
							name="company"
							type="text"
							tabIndex={-1}
							autoComplete="off"
							aria-hidden="true"
						/>
						{status === "error" && error && (
							<p className="contact-error">
								{t(ERROR_KO[error] ?? error, error)}
							</p>
						)}
						<button
							type="submit"
							className="contact-submit"
							disabled={status === "sending"}
						>
							{status === "sending"
								? t("전송 중…", "Sending…")
								: t("전송", "Send")}
						</button>
					</form>
				)}
			</div>
		</>
	);

	return (
		<>
			<button type="button" className={className} onClick={start}>
				{label ?? t("문의하기", "Contact")}
			</button>
			{mounted && open && createPortal(modal, document.body)}
		</>
	);
}
