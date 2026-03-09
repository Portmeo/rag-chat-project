import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Search, BookOpen, Settings, GitCompare, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WelcomeMessageProps {
  onSendQuestion: (question: string) => void;
}

const EXAMPLE_QUESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Search, text: '¿Cómo funciona el flujo de autenticación?' },
  { icon: BookOpen, text: '¿Qué pasos sigue el proceso de registro?' },
  { icon: Settings, text: '¿Cómo se configura el sistema de permisos?' },
  { icon: GitCompare, text: 'Compara los módulos X e Y' },
  { icon: Bell, text: '¿Qué hace el servicio de notificaciones?' },
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
                onClick={() => onSendQuestion(q.text)}
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
