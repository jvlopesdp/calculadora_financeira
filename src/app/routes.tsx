import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/app/app-shell";
import { AuthLayout } from "@/app/auth-layout";
import { NotFoundPage } from "@/app/not-found-page";
import { ProtectedRoute } from "@/app/protected-route";
import { CheckEmailPage } from "@/features/auth/pages/check-email-page";
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page";
import { VerifyEmailPage } from "@/features/auth/pages/verify-email-page";
import { AcompanhamentoDetailPage } from "@/features/acompanhamento/pages/acompanhamento-detail-page";
import { AcompanhamentoNovoPage } from "@/features/acompanhamento/pages/acompanhamento-novo-page";
import { AcompanhamentoPage } from "@/features/acompanhamento/pages/acompanhamento-page";
import { HistoricoDetalhePage } from "@/features/historico/pages/historico-detalhe-page";
import { HistoricoPage } from "@/features/historico/pages/historico-page";
import { AlugarXFinanciarPage } from "@/features/simulator/pages/alugar-x-financiar-page";
import { FinanciamentoPage } from "@/features/simulator/pages/financiamento-page";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/financiamento" replace />} />

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
          <Route path="/historico" element={<HistoricoPage />} />
          <Route
            path="/historico/:scenarioId"
            element={<HistoricoDetalhePage />}
          />
          <Route path="/acompanhamento" element={<AcompanhamentoPage />} />
          <Route
            path="/acompanhamento/novo"
            element={<AcompanhamentoNovoPage />}
          />
          <Route
            path="/acompanhamento/:id"
            element={<AcompanhamentoDetailPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
