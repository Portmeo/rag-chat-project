import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  MessageSquare, Search, BookOpen, Settings, GitCompare,
  Layers, Smartphone, Code, Database, Shield, Globe,
  Zap, FileText, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getOnboardingQuestions } from '@/services/api';
import type { OnboardingQuestion } from '@/services/api';

interface WelcomeMessageProps {
  onSendQuestion: (question: string, filenameFilter?: string[]) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare, Search, BookOpen, Settings, GitCompare,
  Layers, Smartphone, Code, Database, Shield, Globe,
  Zap, FileText, HelpCircle,
};

export default function WelcomeMessage({ onSendQuestion }: WelcomeMessageProps) {
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);

  useEffect(() => {
    getOnboardingQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, []);

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
          {questions.length > 0 && (
            <div className="flex flex-col gap-2">
              {questions.map((q) => {
                const Icon = ICON_MAP[q.icon] || MessageSquare;
                return (
                  <button
                    key={q.id}
                    onClick={() => onSendQuestion(q.text, q.filename ? [q.filename] : undefined)}
                    className="flex items-center gap-2 text-left w-full px-4 py-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{q.text}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
