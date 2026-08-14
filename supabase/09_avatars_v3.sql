-- НищеMap 09: финальный набор аватаров (6 бесплатных + 11 за монеты).
alter table public.submissions drop constraint if exists sane_avatar;
alter table public.submissions add constraint sane_avatar
  check (avatar is null or avatar in (
    'student_m','student_f','office_m','office_f','zapas_m','zapas_f',
    'doshik_m','doshik_f','shaurmaster','shaurmaster_f','tsar','tsar_f',
    'kosmonavt','oligarkh','oligarkh_f','legenda','zoloto'
  ));
