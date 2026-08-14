-- НищеMap 08: расширенный набор аватаров (8 базовых м/ж + 6 за монеты).
alter table public.submissions drop constraint if exists sane_avatar;
alter table public.submissions add constraint sane_avatar
  check (avatar is null or avatar in (
    'student_m','student_f','office_m','office_f',
    'doshik_m','doshik_f','zapas_m','zapas_f',
    'shaurmaster','tsar','kosmonavt','oligarkh','legenda','zoloto'
  ));
