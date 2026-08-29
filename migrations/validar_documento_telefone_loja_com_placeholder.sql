-- Importação em massa de lojas de rede (várias unidades da mesma marca):
-- cpf_cnpj/telefone/celular às vezes entram como placeholder "0000000000"
-- (dado real vem depois, editado uma loja de cada vez). Esse trigger é a
-- validação de verdade — funciona não importa COMO a linha entrou na
-- tabela (CSV importado direto no Supabase Studio, INSERT manual, ou pelo
-- painel), porque roda no banco, não em uma tela específica:
--
--   • Documento/telefone/celular todo em zeros (após tirar máscara) =
--     placeholder de importação em massa → passa livre, sem checar
--     dígito verificador/formato.
--   • Qualquer outro valor (incluindo a edição posterior que troca o
--     placeholder por um dado real) passa pela validação normal.
--   • Só valida quando o campo MUDA (NEW distinto de OLD) — não quando
--     alguém salva a loja editando só o nome/endereço/etc, por exemplo;
--     senão uma loja antiga com telefone em formato legado passaria a
--     travar qualquer edição não relacionada a ela.
--
-- _cpf_valido/_cnpj_valido replicam o mesmo algoritmo (dígito verificador
-- padrão da Receita) já usado no app (_validarCPF/_validarCNPJ, app.js) —
-- mesma regra nos dois lados, banco e cliente.
CREATE OR REPLACE FUNCTION public._cpf_valido(cpf text) RETURNS boolean AS $$
DECLARE
  d int[];
  soma int; resto int; i int;
BEGIN
  IF cpf !~ '^\d{11}$' OR cpf ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  d := ARRAY(SELECT substring(cpf FROM n FOR 1)::int FROM generate_series(1,11) AS n);
  soma := 0;
  FOR i IN 1..9 LOOP soma := soma + d[i]*(11-i); END LOOP;
  resto := (soma*10) % 11; IF resto IN (10,11) THEN resto := 0; END IF;
  IF resto <> d[10] THEN RETURN false; END IF;
  soma := 0;
  FOR i IN 1..10 LOOP soma := soma + d[i]*(12-i); END LOOP;
  resto := (soma*10) % 11; IF resto IN (10,11) THEN resto := 0; END IF;
  RETURN resto = d[11];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public._cnpj_valido(cnpj text) RETURNS boolean AS $$
DECLARE
  d int[];
  pesos1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma int; resto int; i int; dig1 int; dig2 int;
BEGIN
  IF cnpj !~ '^\d{14}$' OR cnpj ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
  d := ARRAY(SELECT substring(cnpj FROM n FOR 1)::int FROM generate_series(1,14) AS n);
  soma := 0;
  FOR i IN 1..12 LOOP soma := soma + d[i]*pesos1[i]; END LOOP;
  resto := soma % 11; dig1 := CASE WHEN resto<2 THEN 0 ELSE 11-resto END;
  IF dig1 <> d[13] THEN RETURN false; END IF;
  soma := 0;
  FOR i IN 1..13 LOOP soma := soma + d[i]*pesos2[i]; END LOOP;
  resto := soma % 11; dig2 := CASE WHEN resto<2 THEN 0 ELSE 11-resto END;
  RETURN dig2 = d[14];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.validar_documento_telefone_loja() RETURNS trigger AS $$
DECLARE
  documento_mudou boolean; telefone_mudou boolean; celular_mudou boolean;
  digits text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    documento_mudou := true; telefone_mudou := true; celular_mudou := true;
  ELSE
    documento_mudou := NEW.documento IS DISTINCT FROM OLD.documento;
    telefone_mudou  := NEW.telefone  IS DISTINCT FROM OLD.telefone;
    celular_mudou   := NEW.celular   IS DISTINCT FROM OLD.celular;
  END IF;

  IF documento_mudou AND NEW.documento IS NOT NULL AND NEW.documento <> '' THEN
    digits := regexp_replace(NEW.documento, '\D', '', 'g');
    IF digits !~ '^0+$' THEN
      IF length(digits) = 11 THEN
        IF NOT public._cpf_valido(digits) THEN RAISE EXCEPTION 'CPF inválido: %', NEW.documento; END IF;
      ELSIF length(digits) = 14 THEN
        IF NOT public._cnpj_valido(digits) THEN RAISE EXCEPTION 'CNPJ inválido: %', NEW.documento; END IF;
      ELSE
        RAISE EXCEPTION 'CPF/CNPJ com quantidade de dígitos inválida: %', NEW.documento;
      END IF;
    END IF;
  END IF;

  IF telefone_mudou AND NEW.telefone IS NOT NULL AND NEW.telefone <> '' THEN
    digits := regexp_replace(NEW.telefone, '\D', '', 'g');
    IF digits !~ '^0+$' AND length(digits) NOT IN (10,11) THEN
      RAISE EXCEPTION 'Telefone (WhatsApp da Loja) com formato inválido: %', NEW.telefone;
    END IF;
  END IF;

  IF celular_mudou AND NEW.celular IS NOT NULL AND NEW.celular <> '' THEN
    digits := regexp_replace(NEW.celular, '\D', '', 'g');
    IF digits !~ '^0+$' AND length(digits) NOT IN (10,11) THEN
      RAISE EXCEPTION 'Celular (WhatsApp Financeiro) com formato inválido: %', NEW.celular;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_documento_telefone_loja ON public.lojas;
CREATE TRIGGER trg_validar_documento_telefone_loja
  BEFORE INSERT OR UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.validar_documento_telefone_loja();
