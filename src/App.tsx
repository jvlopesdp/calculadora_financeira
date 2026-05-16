import { ThemeToggle } from "@/components/theme-toggle";

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-border flex items-center justify-between border-b px-6 py-4">
        <h1 className="font-serif text-2xl font-bold">Simulador Financeiro</h1>
        <ThemeToggle />
      </header>
      <div className="container mx-auto px-6 py-12">
        <p className="text-muted-foreground">
          Em breve: simulação de financiamento, comparação aluguel vs. compra e
          export para Excel.
        </p>
        <p className="font-tabular text-foreground mt-4">R$ 1.234.567,89</p>
      </div>
    </main>
  );
}

export default App;
