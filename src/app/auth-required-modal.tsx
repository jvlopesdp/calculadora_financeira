import { IconLock } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuthRequiredModalProps {
  next: string;
}

/**
 * Modal sobreposto sobre conteúdo protegido para usuários anônimos.
 * Não redireciona — mantém a rota atual como fundo fosco.
 */
export function AuthRequiredModal({ next }: AuthRequiredModalProps) {
  const navigate = useNavigate();

  function handleLogin() {
    navigate(`/login?next=${encodeURIComponent(next)}`);
  }

  function handleRegister() {
    navigate(`/register?next=${encodeURIComponent(next)}`);
  }

  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
            <IconLock className="text-muted-foreground h-6 w-6" />
          </div>
          <DialogTitle className="text-xl">
            Conteúdo exclusivo para cadastrados
          </DialogTitle>
          <DialogDescription className="text-sm">
            Esta seção está disponível apenas para usuários com conta. Faça
            login ou crie uma conta gratuita para acessar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleLogin} className="w-full">
            Entrar na minha conta
          </Button>
          <Button
            variant="outline"
            onClick={handleRegister}
            className="w-full"
          >
            Criar conta gratuita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
