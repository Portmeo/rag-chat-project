export interface Question {
  q: string;
  expected: string[];
  category: 'simple' | 'complex' | 'paraphrase' | 'vague' | 'specific';
}

export const QUESTIONS: Question[] = [
  // ============================================================
  // SIMPLE — un documento, pregunta directa y bien formulada
  // ============================================================
  { category: 'simple', q: "¿Qué versiones de Angular e Ionic se usan en el proyecto?", expected: ["01-arquitectura-general.md"] },
  { category: 'simple', q: "¿Qué tipo de autenticación se usa?", expected: ["04-autenticacion-guards.md"] },
  { category: 'simple', q: "¿Por qué se usa NgRx para gestionar el estado?", expected: ["02-gestion-estado-ngrx.md"] },
  { category: 'simple', q: "¿Cuáles son las ventajas de usar microfrontends?", expected: ["03-microfrontends-web-components.md"] },
  { category: 'simple', q: "¿Cómo se integran los web components en Angular?", expected: ["03-microfrontends-web-components.md"] },
  { category: 'simple', q: "¿Cómo funciona el flujo de autenticación con JWT?", expected: ["04-autenticacion-guards.md"] },
  { category: 'simple', q: "¿Cuál es la diferencia entre Container y Presenter components?", expected: ["08-patron-container-presenter.md"] },
  { category: 'simple', q: "¿Qué versión de React se usa?", expected: ["01-arquitectura-general.md"] },
  { category: 'simple', q: "¿Cuál es el ciclo completo de un cambio de estado en NgRx?", expected: ["02-gestion-estado-ngrx.md"] },

  // ============================================================
  // COMPLEX — multi-documento, requieren cruzar información
  // ============================================================
  { category: 'complex', q: "Describe el flujo completo desde que un usuario hace click en login hasta que ve la página protegida", expected: ["02-gestion-estado-ngrx.md", "04-autenticacion-guards.md"] },
  { category: 'complex', q: "¿Cómo se sincroniza el estado de autenticación entre el AuthService y el store de NgRx, y qué acciones se dispatching durante el login?", expected: ["04-autenticacion-guards.md", "02-gestion-estado-ngrx.md"] },
  { category: 'complex', q: "¿Cómo un Container component obtiene los datos del usuario autenticado del store y los pasa a un Presenter para mostrarlos en pantalla?", expected: ["08-patron-container-presenter.md", "02-gestion-estado-ngrx.md"] },
  { category: 'complex', q: "¿Qué pasos hay desde que se desarrolla un nuevo microfrontend hasta que está desplegado en producción mediante Jenkins?", expected: ["03-microfrontends-web-components.md", "07-ci-cd-deployment.md"] },
  { category: 'complex', q: "¿Cómo varía la URL de la API y la configuración de seguridad entre el entorno dev, pre y pro, y cómo lo gestiona el pipeline de CI/CD?", expected: ["05-configuracion-entornos.md", "07-ci-cd-deployment.md"] },
  { category: 'complex', q: "Si un web component necesita mostrar información del usuario autenticado, ¿qué mecanismo usa para acceder al token JWT y cómo se lo pasa la app principal?", expected: ["03-microfrontends-web-components.md", "04-autenticacion-guards.md"] },
  { category: 'complex', q: "¿Cómo afecta el uso de Capacitor a la gestión del token JWT y al almacenamiento local en dispositivos móviles iOS y Android?", expected: ["06-desarrollo-movil-capacitor.md", "04-autenticacion-guards.md"] },
  { category: 'complex', q: "¿Qué ocurre en el store de NgRx y en los guards de ruta cuando el token JWT expira mientras el usuario navega por la aplicación?", expected: ["02-gestion-estado-ngrx.md", "04-autenticacion-guards.md"] },
  { category: 'complex', q: "Explica cómo el patrón Container-Presenter y NgRx trabajan juntos para mantener la UI reactiva ante cambios de estado, evitando mutaciones directas", expected: ["08-patron-container-presenter.md", "02-gestion-estado-ngrx.md"] },
  { category: 'complex', q: "¿Cuántos web components hay en el proyecto?", expected: ["01-arquitectura-general.md", "03-microfrontends-web-components.md"] },
  { category: 'complex', q: "¿Cuántos web components hay en el proyecto y cuáles son? Lístalos todos", expected: ["03-microfrontends-web-components.md", "01-arquitectura-general.md"] },

  // ============================================================
  // PARAPHRASE — misma información, léxico o estructura distinta
  // Miden si el retriever aguanta variaciones de formulación
  // ============================================================
  { category: 'paraphrase', q: "¿Qué framework frontend y qué versión usa el portal?", expected: ["01-arquitectura-general.md"] },
  { category: 'paraphrase', q: "¿Qué solución de state management utiliza la aplicación?", expected: ["02-gestion-estado-ngrx.md"] },
  { category: 'paraphrase', q: "¿Qué son los Smart y Dumb components?", expected: ["08-patron-container-presenter.md"] },
  { category: 'paraphrase', q: "¿Cómo se protegen las rutas privadas de la aplicación?", expected: ["04-autenticacion-guards.md"] },
  { category: 'paraphrase', q: "¿Cómo se despliega la aplicación para web, Android e iOS?", expected: ["07-ci-cd-deployment.md"] },

  // ============================================================
  // VAGUE — lenguaje natural informal, sin términos técnicos
  // Simulan cómo escriben los usuarios reales
  // ============================================================
  { category: 'vague', q: "¿Cómo funciona el login?", expected: ["04-autenticacion-guards.md"] },
  { category: 'vague', q: "¿Cómo se hace el deploy a producción?", expected: ["07-ci-cd-deployment.md"] },
  { category: 'vague', q: "¿Qué microfrontends tiene la aplicación?", expected: ["03-microfrontends-web-components.md"] },
  { category: 'vague', q: "¿Cómo funciona la aplicación en el móvil?", expected: ["06-desarrollo-movil-capacitor.md"] },
  { category: 'vague', q: "¿Dónde se guarda el estado de la aplicación?", expected: ["02-gestion-estado-ngrx.md"] },

  // ============================================================
  // SPECIFIC — detalles técnicos concretos del corpus
  // Miden precisión: el retriever debe encontrar el fragmento exacto
  // ============================================================
  { category: 'specific', q: "¿Qué versión de Capacitor utiliza el proyecto?", expected: ["06-desarrollo-movil-capacitor.md"] },
  { category: 'specific', q: "¿Cuál es la API mínima de Android soportada?", expected: ["06-desarrollo-movil-capacitor.md"] },
  { category: 'specific', q: "¿Qué versión exacta de NgRx tiene el proyecto?", expected: ["02-gestion-estado-ngrx.md"] },
  { category: 'specific', q: "¿Cuál es la URL de la API en el entorno de producción?", expected: ["05-configuracion-entornos.md"] },
  { category: 'specific', q: "¿Qué plataformas permite construir el Jenkinsfile?", expected: ["07-ci-cd-deployment.md"] },
];
