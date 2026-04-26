import { useState } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'forgot';

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email ou senha inválidos. Tente novamente.');
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError('Não foi possível enviar o email de reset. Verifique o endereço.');
    } else {
      setSuccessMsg('Email de recuperação enviado! Verifique sua caixa de entrada.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Background grid */}
      <div className="login-bg-grid" aria-hidden="true" />

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">⚡</div>
          <div className="login-logo-text">
            Study Manager
            <span>Cybersecurity Planner</span>
          </div>
        </div>

        {mode === 'login' ? (
          <>
            <h1 className="login-title">Bem-vindo de volta</h1>
            <p className="login-subtitle">Entre para continuar seus estudos</p>

            <form className="login-form" onSubmit={handleLogin} id="login-form">
              {error && <div className="login-error">{error}</div>}

              <div className="login-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Senha</label>
                <div className="password-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={loading}
                id="login-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <button
              className="login-link"
              onClick={() => { setMode('forgot'); setError(''); }}
              id="forgot-password-link"
            >
              Esqueci minha senha
            </button>
          </>
        ) : (
          <>
            <h1 className="login-title">Recuperar senha</h1>
            <p className="login-subtitle">Enviaremos um link para seu email</p>

            <form className="login-form" onSubmit={handleForgot} id="forgot-form">
              {error && <div className="login-error">{error}</div>}
              {successMsg && <div className="login-success">{successMsg}</div>}

              <div className="login-field">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={loading}
                id="send-reset-btn"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link de reset'
                )}
              </button>
            </form>

            <button
              className="login-link"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              id="back-to-login-link"
            >
              ← Voltar ao login
            </button>
          </>
        )}

        <p className="login-footer">
          Study Manager — Versão Web/iPad ✦ Tudo gratuito
        </p>
      </div>
    </div>
  );
}
