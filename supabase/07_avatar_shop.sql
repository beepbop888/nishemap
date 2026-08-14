-- НищеMap 07: платные аватары. Запустить в SQL Editor.
-- Расширяем список допустимых значений avatar (в 06 были только базовые).
alter table public.submissions drop constraint if exists sane_avatar;
alter table public.submissions add constraint sane_avatar
  check (avatar is null or avatar in (
    'student','office','doshik','investor','babushka',        -- базовые
    'shaurmaster','tsar','kosmonavt','oligarkh','legenda'     -- за монеты
  ));
