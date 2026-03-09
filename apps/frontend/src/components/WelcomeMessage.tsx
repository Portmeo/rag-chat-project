import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Search, BookOpen, Settings, GitCompare, Layers, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WelcomeMessageProps {
  onSendQuestion: (question: string, filenameFilter?: string[]) => void;
}

const EXAMPLE_QUESTIONS: { icon: LucideIcon; text: string; filename: string }[] = [
  { icon: Layers, text: '¿Qué microfrontends @wc-sca hay disponibles y cómo se integran en un módulo Angular?', filename: '03-microfrontends-web-components.md' },
  { icon: Search, text: '¿Qué feature flags están configurados en cada entorno (dev, pre, pro)?', filename: '05-configuracion-entornos.md' },
  { icon: BookOpen, text: '¿Cuáles son las etapas del pipeline de Jenkins y qué convención de commits se usa?', filename: '07-ci-cd-deployment.md' },
  { icon: GitCompare, text: '¿Qué selectores NgRx usa el dashboard container y cómo se conecta con el presenter?', filename: '08-patron-container-presenter.md' },
  { icon: Settings, text: '¿Qué claves de localStorage usa el sistema de autenticación y cómo funciona el interceptor JWT?', filename: '04-autenticacion-guards.md' },
  { icon: Smartphone, text: '¿Cuál es la diferencia entre los app IDs de Capacitor en dev y producción?', filename: '01-arquitectura-general.md' },
];

export default function WelcomeMessage({ onSendQuestion }: WelcomeMessageProps) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Asistente de Documentación</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Pregunta lo que necesites sobre la documentación del proyecto. Puedes empezar con una de estas sugerencias:
          </p>
          <div className="flex flex-col gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q.text}
                onClick={() => onSendQuestion(q.text, [q.filename])}
                className="flex items-center gap-2 text-left w-full px-4 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
              >
                <q.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
