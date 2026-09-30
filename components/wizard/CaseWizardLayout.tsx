"use client";

import {
  WIZARD_STEPS,
  wizardStepState,
  type WizardStepId,
} from "@/lib/wizard";

export function CaseWizardLayout({
  currentStep,
  children,
}: {
  currentStep: WizardStepId;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[radial-gradient(900px_420px_at_12%_-8%,#d7e4f0_0%,transparent_55%),radial-gradient(700px_380px_at_100%_0%,#e2ebe3_0%,transparent_50%),#eef2f6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside className="w-full shrink-0 lg:sticky lg:top-8 lg:w-64">
          <p className="mb-1 text-sm font-medium tracking-wide text-[#5f7388]">
            Verification Engine
          </p>
          <h1 className="mb-5 text-xl font-semibold tracking-tight text-[#1a2332]">
            Case workflow
          </h1>
          <nav aria-label="Case steps" className="flex flex-col gap-2.5">
            {WIZARD_STEPS.map((step) => {
              const state = wizardStepState(step.id, currentStep);
              return (
                <div
                  key={step.id}
                  aria-current={state === "active" ? "step" : undefined}
                  className={
                    state === "active"
                      ? "rounded-2xl border border-[#2c5f8a] bg-[#2c5f8a] px-4 py-3.5 text-white shadow-[0_8px_24px_rgba(44,95,138,0.22)]"
                      : state === "completed"
                        ? "rounded-2xl border border-[#c5d4e3] bg-white/95 px-4 py-3.5 text-[#1a2332]"
                        : "rounded-2xl border border-transparent bg-white/50 px-4 py-3.5 text-[#8a97a8]"
                  }
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={
                        state === "completed"
                          ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700"
                          : state === "active"
                            ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold"
                            : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8eef4] text-[11px] font-bold text-[#8a97a8]"
                      }
                      aria-hidden
                    >
                      {state === "completed" ? "✓" : step.id}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          state === "active" ? "text-white" : ""
                        }`}
                      >
                        {step.title}
                      </p>
                      <p
                        className={`mt-0.5 text-xs leading-relaxed ${
                          state === "active"
                            ? "text-white/80"
                            : state === "completed"
                              ? "text-[#6b7a8d]"
                              : "text-[#9aa8b8]"
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
