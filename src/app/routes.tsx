import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AppShell } from "@/app/app-shell";
import { AuthLayout } from "@/app/auth-layout";
import { NotFoundPage } from "@/app/not-found-page";
import { ProtectedRoute } from "@/app/protected-route";
import { LandingPage } from "@/features/landing/pages/landing-page";
import { PrivacidadePage } from "@/features/landing/pages/privacidade-page";
import { useSession } from "@/lib/queries/session";
import { CheckEmailPage } from "@/features/auth/pages/check-email-page";
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page";
import { VerifyEmailPage } from "@/features/auth/pages/verify-email-page";
import { AccountPage } from "@/features/account/pages/account-page";
import { AcompanhamentoDetailPage } from "@/features/acompanhamento/pages/acompanhamento-detail-page";
import { AcompanhamentoNovoPage } from "@/features/acompanhamento/pages/acompanhamento-novo-page";
import { AcompanhamentoPage } from "@/features/acompanhamento/pages/acompanhamento-page";
import { AlugarXFinanciarPage } from "@/features/simulator/pages/alugar-x-financiar-page";
import { FinanciamentoPage } from "@/features/simulator/pages/financiamento-page";

/**
 * Rota raiz sensível à sessão: visitantes anônimos veem a LandingPage,
 * usuários autenticados são redirecionados para o app (/financiamento).
 * Enquanto a sessão carrega, não renderiza nada para evitar flicker.
 */
function RootRoute() {
  const { user, isPending } = useSession();
  if (isPending) {
    return null;
  }
  if (user) {
    return <Navigate to="/financiamento" replace />;
  }
  return <LandingPage />;
}

/** Redireciona /historico/:scenarioId e /acompanhamento/:id para /meus-financiamentos/:id. */
function LegacyFinancingDetailRedirect({ paramName }: { paramName: string }) {
  const params = useParams();
  const id = params[paramName];
  const to = id ? `/meus-financiamentos/${id}` : "/meus-financiamentos";
  return <Navigate to={to} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<AppShell />}>
        <Route path="/financiamento" element={<FinanciamentoPage />} />
        <Route
          path="/alugar-x-financiar"
          element={<AlugarXFinanciarPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/meus-financiamentos"
            element={<AcompanhamentoPage />}
          />
          <Route
            path="/meus-financiamentos/novo"
            element={<AcompanhamentoNovoPage />}
          />
          <Route
            path="/meus-financiamentos/:id"
            element={<AcompanhamentoDetailPage />}
          />
          <Route path="/conta" element={<AccountPage />} />
        </Route>

        {/* Redirecionamentos das rotas legadas (Histórico + Acompanhamento) para a nova aba "Meus Financiamentos". */}
        <Route
          path="/historico"
          element={<Navigate to="/meus-financiamentos" replace />}
        />
        <Route
          path="/historico/:scenarioId"
          element={<LegacyFinancingDetailRedirect paramName="scenarioId" />}
        />
        <Route
          path="/acompanhamento"
          element={<Navigate to="/meus-financiamentos" replace />}
        />
        <Route
          path="/acompanhamento/novo"
          element={<Navigate to="/meus-financiamentos/novo" replace />}
        />
        <Route
          path="/acompanhamento/:id"
          element={<LegacyFinancingDetailRedirect paramName="id" />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
