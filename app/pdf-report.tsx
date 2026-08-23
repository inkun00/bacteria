"use client";

/* eslint-disable @next/next/no-img-element -- Static badge images in printable PDF layout */

import { useCallback, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { assetUrl } from "./assets";
import { type WorksheetReport } from "./worksheet-generator";

export const ARI_RANK_URL = "https://samboard.vivasam.com/studentEntry/?brdId=brd-0RCYWQ7PX34T4";

export async function exportWorksheetToPdf(report: WorksheetReport): Promise<void> {
  const container = document.getElementById("factor-force-pdf-render-root");
  if (!container) {
    throw new Error("PDF 렌더링 요소를 찾을 수 없습니다.");
  }

  // Make container temporarily visible for capture
  container.style.display = "block";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1000";

  try {
    const pages = container.querySelectorAll<HTMLElement>(".ff-pdf-page");
    if (!pages.length) throw new Error("출력할 페이지가 없습니다.");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < pages.length; index += 1) {
      const pageElement = pages[index];
      const canvas = await html2canvas(pageElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      if (index > 0) {
        pdf.addPage("a4", "portrait");
      }
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    }

    const safeName = (report.studentName || "지구방어대원").replace(/[^\w가-힣]/g, "_");
    pdf.save(`Factor_Force_인증서_및_오답학습지_${safeName}.pdf`);
  } finally {
    container.style.display = "none";
  }
}

export function PdfDocumentTemplate({ report }: { report: WorksheetReport }) {
  // 6 problems per page, exactly 12 problems total across 2 pages
  const problemsPerPage = 6;
  const problemPages: typeof report.problems[] = [];
  for (let i = 0; i < report.problems.length; i += problemsPerPage) {
    problemPages.push(report.problems.slice(i, i + problemsPerPage));
  }

  return (
    <div id="factor-force-pdf-render-root" style={{ display: "none" }}>
      {/* PAGE 1: OFFICIAL CERTIFICATE */}
      <div className="ff-pdf-page ff-certificate-page">
        <div className="cert-border-outer">
          <div className="cert-border-inner">
            {/* Header / Emblem */}
            <div className="cert-top">
              <div className="cert-logo-badge">
                <img src={assetUrl(report.tier.badge)} alt="" />
              </div>
              <div className="cert-header-text">
                <span className="cert-kicker">FACTOR FORCE EARTH DEFENSE COMMAND</span>
                <h1 className="cert-main-title">수 료 및 임 명 인 증 서</h1>
                <p className="cert-subtitle">약수와 배수 지구 방어 작전 완수</p>
              </div>
            </div>

            {/* Recipient info */}
            <div className="cert-recipient-box">
              <div className="cert-name-row">
                <span className="cert-label">대 원 성 명 :</span>
                <strong className="cert-name">{report.studentName}</strong>
              </div>
              <div className="cert-meta-grid">
                <div className="cert-meta-item">
                  <span>부여 칭호</span>
                  <b>{report.tier.title} (LEVEL {report.tier.level})</b>
                </div>
                <div className="cert-meta-item">
                  <span>총 시도 횟수</span>
                  <b>{report.attempts}회 작전 완수</b>
                </div>
                <div className="cert-meta-item">
                  <span>명예의 전당 순위</span>
                  <b className="cert-rank-highlight">{report.rankText}</b>
                </div>
              </div>
            </div>

            {/* Citation Statement */}
            <div className="cert-body">
              <p>
                위 대원은 2042년 지구를 위협한 숫자 질병 세균의 확산 속에서,
                초등학교 수학 5학년 1학기 「약수와 배수」 전 단원(약수, 배수, 공약수, 최대공약수,
                공배수, 최소공배수)의 핵심 수학 원리를 완벽히 탐구하고 치료 세균을 능숙하게 지휘하여
                우두머리 세균 <strong>제로 프라임</strong>을 격퇴하였습니다.
              </p>
              <p>
                탁월한 수학적 사고력과 용기로 인류의 평화와 지구를 안전하게 지켜냈으므로,
                지구 방어대 수호 대원으로 임명하며 본 수료 및 임명 인증서를 수여합니다.
              </p>
            </div>

            {/* Bottom Footer & Seal */}
            <div className="cert-footer">
              <div className="cert-doc-info">
                <span>인증번호 : {report.certificateNumber}</span>
                <span>발행일자 : {report.issuedAt}</span>
              </div>
              <div className="cert-issuer">
                <div className="cert-issuer-text">
                  <span>FACTOR FORCE 대한민국 사령부</span>
                  <strong>지구방어작전사령관</strong>
                </div>
                <div className="cert-seal">
                  <span>지구방어<br />사령관인</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2+: WORKSHEET PAGES (Up to 8 problems per page) */}
      {problemPages.map((pageProblems, pageIdx) => {
        return (
          <div key={`worksheet-page-${pageIdx}`} className="ff-pdf-page ff-worksheet-page">
            <div className="ws-container">
              {/* Problems Container */}
              <div className="ws-problems-list">
                {pageProblems.map((prob) => (
                  <div key={prob.index} className="ws-problem-card">
                    <div className="ws-problem-top">
                      <span className="ws-badge-num">문항 {prob.index}</span>
                      <span className="ws-badge-lesson">{prob.lesson}</span>
                    </div>

                    <div className="ws-problem-split">
                      {/* Left: Original problem */}
                      <div className="ws-col-original">
                        <div className="ws-task-box">
                          <p className="ws-prompt">{prob.originalTask.prompt}</p>
                          {prob.originalTask.context && (
                            <p className="ws-context">{prob.originalTask.context}</p>
                          )}
                          {prob.originalTask.options && prob.originalTask.options.length > 0 && (
                            <div className="ws-options-preview">
                              {prob.originalTask.options.join(" · ")}
                            </div>
                          )}
                          <div className="ws-workspace-area">
                            <div className="ws-workspace-lines" />
                          </div>
                        </div>
                      </div>

                      {/* Right: Similar practice problem */}
                      <div className="ws-col-similar">
                        <div className="ws-similar-box">
                          <p className="ws-similar-prompt">{prob.similarTask.prompt}</p>
                          {prob.similarTask.context && (
                            <p className="ws-similar-context">{prob.similarTask.context}</p>
                          )}
                          {prob.similarTask.options && prob.similarTask.options.length > 0 && (
                            <div className="ws-similar-options">
                              {prob.similarTask.options.map((opt, optIdx) => (
                                <span key={optIdx} className="ws-opt-chip">① {opt}</span>
                              ))}
                            </div>
                          )}
                          <div className="ws-workspace-area">
                            <div className="ws-workspace-lines" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Requirement: 1페이지에는 오답문제 정답, 2페이지에는 쌍둥이문제 정답 */}
              {pageIdx === 0 && (
                <div className="ws-footer-answers">
                  <div className="ws-footer-title">
                    <span>[ 오답 문제 정답 (Answer Key) ]</span>
                    <small>문제를 스스로 모두 푼 다음 확인하세요.</small>
                  </div>
                  <div className="ws-footer-list">
                    {pageProblems.map((prob) => (
                      <div key={`ans-orig-${prob.index}`} className="ws-answer-item">
                        <b>{prob.index}.</b>{" "}
                        <span>{prob.originalTask.answers ? prob.originalTask.answers.join(", ") : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(pageIdx === 1 || (pageIdx === 0 && problemPages.length === 1)) && (
                <div className="ws-footer-answers">
                  <div className="ws-footer-title">
                    <span>[ 쌍둥이 문제 정답 (Answer Key) ]</span>
                    <small>문제를 스스로 모두 푼 다음 확인하세요.</small>
                  </div>
                  <div className="ws-footer-list">
                    {pageProblems.map((prob) => (
                      <div key={`ans-sim-${prob.index}`} className="ws-answer-item">
                        <b>{prob.index}.</b> <span>{prob.similarTask.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PdfDownloadButton({
  report,
  className = "",
}: {
  report: WorksheetReport;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = useCallback(async () => {
    window.open(ARI_RANK_URL, "_blank", "noopener,noreferrer");
    setLoading(true);
    setError("");
    try {
      await exportWorksheetToPdf(report);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [report]);

  return (
    <div className="pdf-download-widget">
      <PdfDocumentTemplate report={report} />
      <button
        type="button"
        className={`pdf-export-button ${className} ${loading ? "loading" : ""}`}
        onClick={handleDownload}
        disabled={loading}
        title="수료 인증서와 오답 맞춤형 학습지를 PDF로 다운로드하고 아리 랭크를 새 탭에서 엽니다."
      >
        <span className="pdf-icon" aria-hidden="true">📄</span>
        <span>
          <b>{loading ? "PDF 문서 생성 중..." : "인증서 & 오답 학습지 PDF 다운로드"}</b>
          <small>{report.isPerfectScore ? "수료증 + 심화 마스터 문제" : `수료증 + 오답 ${report.totalIncorrectCount}문항 복습지`}</small>
        </span>
      </button>
      {error && <p className="pdf-download-error" role="alert">{error}</p>}
    </div>
  );
}
