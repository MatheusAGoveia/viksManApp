# E-mails da Viks Man

No painel do Supabase, abra **Authentication → Email Templates** e substitua o assunto e o HTML de cada modelo abaixo. Os botões usam `{{ .ConfirmationURL }}`, a URL segura gerada pelo Supabase para cada ação.

## Confirm signup

**Assunto:** `Confirme seu cadastro na Viks Man`

```html
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f2f3f5;font-family:Arial,Helvetica,sans-serif;color:#101114;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f2f3f5;"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:30px 34px;background:#101114;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#77a1ff;">VIKS MAN</div>
          <div style="margin-top:10px;font-size:27px;font-weight:800;line-height:1.15;">Seu próximo corte começa aqui.</div>
        </td></tr>
        <tr><td style="padding:34px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá{{ if .Data.full_name }}, {{ .Data.full_name }}{{ end }}.</p>
          <p style="margin:0 0 26px;font-size:16px;line-height:1.6;">Confirme seu e-mail para ativar sua conta e agendar na Viks Man.</p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 22px;border-radius:10px;background:#135DFF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.4px;">CONFIRMAR CADASTRO</a>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#676a73;">Se você não criou esta conta, pode ignorar este e-mail.</p>
        </td></tr>
        <tr><td style="padding:20px 34px;background:#f7f7f8;font-size:12px;line-height:1.5;color:#676a73;">Viks Man · Betim/MG<br>Atendimento com hora marcada.</td></tr>
      </table>
    </td></tr></table>
  </body>
</html>
```

## Reset password

**Assunto:** `Redefina sua senha da Viks Man`

```html
<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f2f3f5;font-family:Arial,Helvetica,sans-serif;color:#101114;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;"><tr><td style="padding:30px 34px;background:#101114;color:#ffffff;"><div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#77a1ff;">VIKS MAN</div><div style="margin-top:10px;font-size:27px;font-weight:800;">Vamos recuperar seu acesso.</div></td></tr><tr><td style="padding:34px;"><p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Recebemos um pedido para criar uma nova senha.</p><p style="margin:0 0 26px;font-size:16px;line-height:1.6;">Use o botão abaixo. Por segurança, este link é pessoal e temporário.</p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 22px;border-radius:10px;background:#135DFF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.4px;">CRIAR NOVA SENHA</a><p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#676a73;">Não foi você? Ignore este e-mail; sua senha atual permanece a mesma.</p></td></tr><tr><td style="padding:20px 34px;background:#f7f7f8;font-size:12px;color:#676a73;">Viks Man · Betim/MG</td></tr></table></td></tr></table></body></html>
```

## Change email address

**Assunto:** `Confirme seu novo e-mail na Viks Man`

```html
<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f2f3f5;font-family:Arial,Helvetica,sans-serif;color:#101114;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;"><tr><td style="padding:30px 34px;background:#101114;color:#ffffff;"><div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#77a1ff;">VIKS MAN</div><div style="margin-top:10px;font-size:27px;font-weight:800;">Confirme seu novo e-mail.</div></td></tr><tr><td style="padding:34px;"><p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Você pediu para usar <strong>{{ .NewEmail }}</strong> na sua conta.</p><p style="margin:0 0 26px;font-size:16px;line-height:1.6;">Confirme a alteração para concluir.</p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 22px;border-radius:10px;background:#135DFF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.4px;">CONFIRMAR NOVO E-MAIL</a><p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#676a73;">Não reconhece este pedido? Ignore este e-mail e revise a segurança da sua conta.</p></td></tr><tr><td style="padding:20px 34px;background:#f7f7f8;font-size:12px;color:#676a73;">Viks Man · Betim/MG</td></tr></table></td></tr></table></body></html>
```

## Invite user

**Assunto:** `Você foi convidado para a equipe Viks Man`

```html
<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f2f3f5;font-family:Arial,Helvetica,sans-serif;color:#101114;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;"><tr><td style="padding:30px 34px;background:#101114;color:#ffffff;"><div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#77a1ff;">VIKS MAN</div><div style="margin-top:10px;font-size:27px;font-weight:800;">Você faz parte do time.</div></td></tr><tr><td style="padding:34px;"><p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Você recebeu um convite para acessar a operação da Viks Man.</p><p style="margin:0 0 26px;font-size:16px;line-height:1.6;">Aceite o convite para criar sua senha e começar.</p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 22px;border-radius:10px;background:#135DFF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.4px;">ACEITAR CONVITE</a><p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#676a73;">Se este convite chegou por engano, você pode ignorá-lo.</p></td></tr><tr><td style="padding:20px 34px;background:#f7f7f8;font-size:12px;color:#676a73;">Viks Man · Betim/MG</td></tr></table></td></tr></table></body></html>
```

## Antes de enviar para clientes

1. Em **Authentication → URL Configuration**, deixe a URL pública da Viks Man como `Site URL` e também na lista de `Redirect URLs`.
2. Em produção, configure um SMTP próprio e desative rastreamento de links do provedor de e-mail. Isso evita que links de confirmação sejam alterados ou consumidos antes do clique.
