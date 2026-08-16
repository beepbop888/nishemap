# Базовая SD1.5 обучена на стоках и дорисовывает водяные знаки iStock/Getty.
# Для коммерческого приложения это неприемлемо — глушим их отдельно и жёстко.
NEG = ("istock, getty images, shutterstock, alamy, dreamstime, stock photo, watermark, watermarked, "
       "logo, signature, text, letters, caption, frame, border, "
       "photo, photorealistic, 3d render, blurry, low quality, jpeg artifacts, "
       "two people, group, crowd, multiple characters, extra limbs, deformed face, ugly, cropped head")

STYLES = {
 # значок-эмаль: перекликается с монетой и медалями, которые уже одобрены
 "enamel":  ("cloisonne enamel pin badge of a single character bust, glossy enamel fill, "
             "polished gold metal outlines, flat saturated colors, centered, symmetrical, "
             "plain dark background, clean vector emblem"),
 # советская детская книга: живая иллюстрация, тёплая палитра
 "gouache": ("soviet childrens book illustration, single character portrait, bust, centered, "
             "gouache paint, flat shapes, warm muted palette, thick confident outlines, folk art, "
             "plain background"),
 # плоский вектор без стоковой родословной
 "flat":    ("flat vector character bust, thick black outline, cel shading, four color palette, "
             "geometric simple shapes, centered, plain solid background, corporate memphis avoided, "
             "clean illustration"),
 # лаковая миниатюра — палех: очень русское и очень нарядное
 "palekh":  ("palekh russian lacquer miniature, gold leaf on black lacquer, fine gold linework, "
             "single figure bust, centered, ornamental border, jewel tones"),
}
CHARS = {
 "student":     "young man wearing a grey fur ushanka hat with ear flaps, tired expression",
 "babushka":    "old woman in a red headscarf tied under the chin, kind wrinkled face",
 "doshikovod":  "young man holding an instant noodle cup, cheerful",
 "shaurmaster": "man with a short black beard wearing a white apron and red cap",
 "gopnik":      "young man in a black tracksuit with white stripes and a flat cap, squinting",
 "dvornik":     "older man with a thick moustache in an orange work vest and brown fur hat",
 "hokkeist":    "ice hockey player wearing a red helmet with a metal face cage",
 "kosmonavt":   "cosmonaut wearing a white space helmet with the gold visor lifted, face visible",
 "tsar":        "russian tsar wearing a tall gold fur trimmed crown, long dark beard",
 "oligarh":     "wealthy man in a black top hat with a monocle and fur collar, smug",
 "zolotoy":     "man wearing an all gold fur ushanka hat with a red star, golden coat, grinning",
}
