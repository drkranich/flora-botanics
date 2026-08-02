/**
 * Flora Botanics — Template centralizado de PDF
 *
 * Todos os relatórios do sistema (Auditoria, CRM, Orçamentos…) usam esta função.
 * Exceção: etiquetas de envio/produto — fundo branco puro, sem watermark.
 *
 * Resultado: HTML string pronto para window.open + window.print()
 */

export interface PdfConfig {
  /** Nome completo da empresa (rodapé) */
  companyName?: string;
  /** Endereço completo */
  address?: string;
  /** CNPJ */
  cnpj?: string;
  /** Telefone / WhatsApp */
  phone?: string;
  /** E-mail de contato */
  email?: string;
  /** URL do site */
  website?: string;
  /** Observações padrão (aparece no rodapé de todos os PDFs) */
  defaultNotes?: string;
}

export interface PdfBuildOptions {
  /** Título do documento (ex.: "Auditoria do Pedido #123") */
  title: string;
  /** Subtítulo / metadata linha única */
  subtitle?: string;
  /** HTML do conteúdo principal (tabelas, listas, seções) */
  body: string;
  /** Configurações de identidade visual e rodapé */
  config?: PdfConfig;
  /** Largura máxima do conteúdo em px (padrão: 900) */
  maxWidth?: number;
}

// ─── Logo Flora Botanics — Base64 pré-computado ─────────────────────────────
// SVG de folhas/pétalas estilizadas em espelho (identidade Flora Botanics).
// Embutido como Base64 para garantir renderização correta em qualquer browser
// e em qualquer contexto (servidor / cliente / popup de impressão).
const FLORA_LOGO_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAAD9CAYAAABncGgJAAA/KklEQVR42u19aYxk13Xe916tvU6vs5JDcjjkDClSEinJkiXF0WZbXuLYjpM4CeD8MBwnAYwAsYPAvwIHAZIfQZA/TuDEgWEji4HEMOAgDmx5iSRLsiLSFEWK63Cdvaen97W2lx/3O7mnbr9XVd1d1V1VfQ5QqKpb99173qt3v3fOuWeJAJyFowhAot47bdtv/6wx0KNxh523w45hvNk92zPe8oqZ8D2rTb636neQMXo1bi94azfGUfK23zGMt+HjrW/XUwwjIyOjHpEBjJGRUV8CTAQglyJG5VqIWaG4FfMVpfASp4wT/hYHx8Up8+i+aeJelHJOUcr1yaXwHvIZG3AbGXnKH+LYKoAtAGMAamwrAFgDMMKxEy62HbWA6/y9AWBdLdA6gFHVb5ufy8G8CY8r8HOD40UANjlvg+MWVVuVx9Q5ZqT4KnOsCttG2XcDQIljrXK8Io/Z4Ocd/l7iXEXyXjzk9TUyOpEAE3GxfhLAJwB8C8A8gPcJLj8O4AUAf6LA5TKAq1z4twA8B+ACgL8GYInj3gPwf7gwNwB8hv2/qoCnBuA0j1sgLwsAvkLg+CSAaY7xAoD3APwN8nsewB2O87/I12cJKl/ntfg+AJ8G8Ots/1kA3wBwH8BPAXgXwO/z2C/wmDEAbwF4CcDnKOlMAfgmgNsKCI2MTEXqEGAaXDyfA/AmgO9yQV7nAt3gIqwTSP4ZF+GfA/hFAB8H8DaBZxrAdwD8cwBzHCcH4CcB/LRanAkX6/sArgAYJ7j8EoHnLwP4eQLbfQC/QuBbA/AqgB8irxscJyJQ/U01xxsAPkJ+lwh69whUHyWg3AXwtwD8GIA/5HgPAfgwgH8A4I95DucJbJHdZkYGMJ2T7HPvchF+lovrmwSG+/wtT5XhUzzmDYLSAoDvJyjc59P+QwD+B4AVgtLjXKhzAJ4kWGl7yQKAczzuP3MeAZAVAtYUgGcB/C5VuS2CwR9wvKsAvgTgDAGrQj7/La/LPwZwje0NAMucJ0f+n1fSzx+RpxqA/8q536LaZNKLUdSF46MjmKdvJBgou8tfUIIZ5xNbftum+rClbCQN9lvhwqvR/vFFAtAyAeYq7SyrVFu2Fa91fr5LUPpJAI8QrE5xzAJfK1SX6py7zvYKgCc4/rqaI+L3X6aK9uMElYaau0EAFWlLbEcjAP4pgN8A8HcoUW2ZBHMiqKGk1fAltr20zYXQt0p/bwQmiYpqz/JFqXUwBzL4jPoFYBK+ztEeUubTPKE0MAfnHfxhAD9HKeE1qlOf4gL+HQAzAB7kAv43AP4J7Rof5Lh/SsngrwJ4TEkSk5x7mmpIjq//RjD5GIDPA/gzgl+JfM0DeIDSy/cAmOUcfwzgJ6jmnCWw3CNPj/FPm+F5XeAcvwHgKQA/SJVwDsDTHOd52pjuwBu6jYaXZNPiLIFghw8g2TDIA7ioTAYNfq6ovuD3Kl91Poil71mOAT60d3hfygNul33nFF8VvnbVmNK/yuOr6vdqr0S3c+pzJ+7AgqKP8oQWaU9JeBHOUBooEExe46J8gkDwBtvnaYOpA3iZi7moJJ5XydtZSivvEBCnOHeV471HQEgIPpd50V5VAPoI51uiGvV4MMc5ADd5M5wlPysALtGuNM9z2wXwOvm/wLlu8vwFhGaoCr4Lv1sWXvMko62Ta3/YMXo17knkTXYwn+S9ITuWed7XW7ynL/G+2aWa/jD8Duwu1emLBIAax5nj/bvN+z2m6i8gssq1sEowmuBD9yvk7yG+l3m/Vinhr7P/Js9lgmOA6yjXzet2UIDRiJunlAAlyskFzqlFJihbgt82FrvHCFE5UceWFbIWlWG2xrHiYDwoNI8VT2Cb8FPmXHJzVNQcCT/LNvs2x5E5c2o+eQoVlRomTwrhF7aIh5Y3uRdn+aARtfu+kgwe5AOozPvtHu+PK+wnLh4vEhAqfEC9zX5n1Bqq8GFaVZJ1g+/aLeQ2H6If4n24otbghFLl1hSPqwSnLyN91/PA1+0wfhplxbhMUAoWdqJ+G1FtDV64cfV9LEUVK8H7wYgkIMeFTxJR+caCNuE1Vm1ldXwpkDTK6pzEP6bAPytSYm5RnWtDqWpRiq5sNHyUqE2NUd53f8T7IlaAIv5XVUoPW3zXa2KNKnWFUvYMJf1EPRjFr2qV/W9TYt+ghL2o7v0xtsfkLeH4W3xoPsD2VQLQIsGm6y4Vh5FgoH4LozjDMRoK8SMlhkXKaKuPrfOlgzFDPgSYCgGQRW0kB3sSG2/d5k2kiTjjvpe2vHr4JOp3cQDVDqcNZRwWMBulaiMbGTXOWVeSf1FpGDElrFUCnGgIM9xQqaiHZUOtt2OXYOSEY6XGRMFFrQdPdNH36kTgAn8f40Wrq75F6pfLwUXTf84Ix1hSoBUrJDZ3faOjomKHCxBqkYdtRfXAnKJUgUBKj5UU3wjea+phK+ASU8LSa7EG5+yaI9DUKFGFQkJX6DAA8zEyt0Qx6wEyus5xxWAb8YQXATxD0LhDVL3CftcVWD3IccepSxZo5JUnxVO8QGdoaH2FqkpD2W1WCGIGMkZHpS5lSfjIkK7T+lfgdl8vw/mV1bg+cnwIPw7gBu/tSapG15V5Auohm2M/UYl2OX+e6+Qe19ZTcG4mMxy73g8AIycxArdVfIkX5wJPbEsBzAQBQSSOS7Si/1+2rcJtYa+rC7NEa3lRIfI49c4ztLiLqPgMedohuMzyoj+n7ClGRoNCOT4gH+f9PcU1MgPnxX4V3oesDufWESsQGucDeZYG5iqBSMwQY3w/A+dIGsO5bYgRGccNMKIe1eG8V0eIlGtkXnZeRK3Z5W9inFoimNzjxZiBi2eKeIw43y3QUFVXktEZuC29eaXvbgSi3S6BLQfzQTEaLJKg2hLv94QqToXrqsqHpzx0C8rsIMevE2i21bq4C5/5oKhsLWKfWVQP6FI3H8oHNfImyhYSin+hJyKUjaQW2G8aaN4BSlIMtFGgsybKuJVkGHVjdUHNWGm8DRJv9ZQ1oW2bcq/HaDYUA9kpM8PNkTQ+ckrKOXYjb4TW++VpkwLNxtoEne+5h7+VOvizTDUyGkTK9whAO1mnjV6eTK8MW2hxQdqNgUAqyprDVCGjYaGkw/WEDtcO9rFOe6LzGRkZGRnAGBkZDa6+t1+qo7dGt16Na8ZK423YeOvWeor7AWDE6/Cn4LaT67CYGyOjQbb55OC2tX8He3PXHIoOE4s0kjGeSTDGm/E2eBIM4JOu9UU09WaAgllBiVl78yGKAtklL3GAMY6Ct1ZjtBu3F7wddNx+um5H8Z9iH//ZcV83tLn/ky7xFvdCEzkMwOTMBmO8GW9DZYPp+pa17SIZGRn1jAxgjIyMDGCMjIwMYIyMjIwMYIyMjPofYNp5/4V5evV7qzEPch76lcZH2vhdTxFoZGTk6TDb1FI+VlJVhiAi6RgkVZ8k95Ys6wJO9eA4yRmTlYA4jbbhc8TE8JUkE8WHlEipq37iwVhEdrLwEEwTWPS2kVFHlIPLiJUlYWRJHZJn92G+bsJXApASlzW4Wiv/EK4I2Y/BZaObgU/yvUMepNLcGly51mm4sg26VIlIKiFPVbiUf99LXspwGbx2A9D4R3CZu74AlyXsFlxB+5+CS9+p6zxBnYNIOZLxS5KK4wDXrV3bUYxhvA0fb+hX3g6qIgnAfALAzxMIrsJVoHsKrjriOBf8g3D5dW/AJR/+Fb5Pw5VdLfO4ZwkSVbi0mg/CJRafgw+s3IGv7bKtAG2MYDEK4BfIz7PwhasehcsdfAEuVecGP58njzW46nwfhk8/mLDtp+EqQz4F4G8D+FGzXRkZ9U5FEtXoHIGgCJeg+BIX8n1KRWNwpVmXCBo/AOC/U4qYAvAzAL4G4Gfhkg1/Gq6e9JMEiiVKG5sA/gUB6Sml+uQpOb3PMeVcfpVS0zRcvtE8XB7TRYLTDxJEPg1fQ/pH4KsiPAngt+DqY3+U788R6JbhEpT/OXxhKyMjoww6zAJ5lov2O3zKL8HXIxrngrxJsIgoqYjNJgdXJ/eWklCWAfwnAsoMF7pkU5dk4HcJCHd47BZ8TeoJuGjQ53nstwH8NiWUO+RBUm3O0k5zi8eeh68bfAa+OsEM2+6Tly+QhwLMQGxk1BMbjJR5fQzAS1xwo7SZiI3ifQBfhau3e4tqzCpcmYRNgskLHOP34JN/LxCc7rDPTb7uEUw2KWVs8FXjOczz9wWqUa8SKJYoJV2Ez5y+ybnfoSp3D64mryQh/5/qXO8TQG9Smok4zzvkI5ehp5otwXgzGwwOV1VgBz4fzDYlgpqSUCJlO8nztxIBqBj81iA4jXFcATJZ9KMBPyFvuwSxUXijcQW+BIOuZlBXEhH4vQxvnC7BV8yr8nMevoQKCILxAa4bYEF7xlt/Bzv2TVWBcS64glrIJewtsyCfpcC8qBdFNGcyLyvpqNPk4FCgMKJAq4jmcp4lNVes+NClUgoK2KQsREnNP4HmUhG2VW1k1AMjr170kZIC9OLUPigR0usopRWzR8bijdqgaYLmkgtJisSVBg6NFqiNoK0RnFOnQGxAZHRi6TBG3grVjAqaC96ngcx+gauOvYXZhKop+l49pT383O73LF1S8xCl8JnmIyTnXlHXIOxbM/AxMoDJpofhtnAfoVpThdsaHoPbGdql2lNWwNNQaoz+LqBUhdvVuQxnRJ1Uqo9ISc+qxSvA8QTcThAU4EkFSCkg/hTbdxVgVJXdqKJ4qyrQGuNLg9gunIH4MdqMtERUhd8Je4bX+BzcFv6Omltqb6eBqJHRiVWRxMnuATij6jacX4vs5tzjgrtIu8UKvBv/NtxOjyy2HAGoCGdELXHsHJy/ySm4XSrA7UxNENQ+zXFuA3gabofqgwQlKLWtAbfrkyevH1GA9zLBsQDgTQAfJw8rBI9deMNwA75mcA3A6zwH2ZK/QcCYVHapKnmtk+88f7/Ots/D1eSegduBWz+kympkNDQ2GIkhuseFOwW/0yLG3FGCwCNwjnSneOykWmwR/A5Rge27bJPC30WCwiiPSeC2oG9TYjpPfpbhfFckLqnOuW/we8TjNpVkNE2eJznPCnxZXDE4C2id4jE7CjBKnHuBx00SkKQw+S752yb/Ma+ZXLtNSmvmsGc0lHSYqgJTfEoXlcQgthOxi+SUvULsDptc2DXVV7aCnwDwYqBGxZxjiQt8nAu2Cu9kp7eitdSRUKqqUgLZ4RixkhhylHIm4B33SgSIolKX8vDb1quUWMQPZwEurGENwNucI8/3LY4l12ZV2XZKvI73OXYM2wo23nozxrHwdhiAqQfgESHdX0baYiX91IL+DWUATVtkgE8yrqOmNR/tMsfrsRsK/BrwfjqxOk7zpc9BfHcq6recMuTmUvjS1yGP5q38mgJpW8TG21ABzGF0/jxal09oxXg++C1trLSTEWlGj1fE3t2qVnzEChAiNWfolZvGix6vmAKgUXB8rEAqrZRE6GtjZDRU1A3dvxv5UZJ9LLL9OOHtt30//ZIunZcBi5EBjJGRkZEBjJGRkQGMkZHR8NNhY5FC93crHbv/cQ3kjQxgUsBFvGM7KXKuj0NK/07b9jtuq0XfqpA4UsbuhI9WY6RVM2jA+fRY4iojA5jgqXsR2VHJ4lcC+BwsuWBR6rQIifrcCJ7s0i7Skq5QoEEl9KnJwfvbpPne6Fw0IZDoNBIIzqsetDdSJJPQbwbBuQgV4LyHF9C8TW5kdCIBRnugAs4rVbxwC2oRrcK590s2/jK8C78AkXjKbqrjt+EDJ8VFfxTOG1ZCCtbhvG4l+DAHH0Qo3rMJF+0snEPcJlxckAQ6iqOe5NUtKlCTAMhx+OBFOedl+NgpiSSfUOAnQCoBjDpiWnx2KvBxWDF8yRdLwWlkEoxaDFJvaAcuG/+TcEGA83ApKL8PvgrAxwF8Ha58yacB/Bc41/ovwCXQHuVY63AJxP8czoV+lzw+Bpe68lG4kIEYLgXmswD+gvOeImD8AOfdgE9ulZCPCly1gmtwwZoilSzCRVv/Gd934NJ2PgmXLlMA8CUC2GPwSatuwYU4vAkX+3Sd1+hjAP6I57NKkBvjWF8jmGpHPCOjoaPDGBgjpR6JJCJBjY9zIcVcVON80j8K4Arfq3x6z/JdYnxW4YMEP6FsFCIhzHDeZQLEg5zrIUoMosacV7xd4Dh3KIlswQVLXuD8kjYzJqDMwecPvqekszElzVznsW9zvOvqnEs83yLnmVLnUIYPpkwLrzAyGhrabyySqEhlHidqzDx8aoQHCRLiOr+pJBRRUeoEgzPwWfonuEjPE3wkMLHERR7DBUkuwuebkQjuFbXwH+Dndwhkm3DBhI/CpXyYUaqLDhsoKZVojec1S4mpDBdU+TaPn1RSUgJffWBMqUgV+OjrDY57TgFdQdmKbqaAjcX7GG8nLthR22AuciFKeoJI2UPyaA5SDAMSZTFV1dNcpI2qkq50jl0dTFhT6kUezVHbu8quIp8lOLGQYaQNjbViH6koQ3CdgFFFc8VJ3a+OvbtSumZ2he8FpWKCwBfbQjHehg1g9muD0Vn8VyiZ6Kz/wN7gvVaMj2DvzlIJ2QGGadvDYSxSKVDddOJvMfCm8YYU/kopfdNqZhcDnpBxzpo3AdF7ZoMxMiPvXvRayGg3R7vOx03QnO7ByMgARqkHiQFMV8Y1MhpKMjd1IyMjAxgjIyMDGCMjIyMDGCMjo95TDs7BzcjIyKjrdNhdJCMjo+Ghei8BZj/brQmcF69tUxtvxtvwePJKccBjLVsicTt/nwylFYA3MjIaDJJChVsAfgPOS79r6/mg+WDyAL4IX6FR/64Zz8o6hx6DUuj+H9ZAGsabJO3atjv3dtn8stp7cU2zMhWGSbqMun/v5OGCen8L6YnSugIwaTV8sur6iIokmeJyvDF0giWdeEkH/CVK32tgbzxQ3CVw0RUcy0RmXa52mChGc5yVPk9JclXH3iqbUcY1i4Knmy7j2+1rGoZL1FR7ga8t7C1YZ9RdgFnH/uqIdYQXhzXySqS0JHOah4+k3uBNWOKNuA0XaV3gTXSKv9Xho6gj9jsMRWoRTBCZvwOXL+Y0eagMEcjItZ7gtcvDpY/Y4nV+Gy6FxhR8qlFJmyGLWaLMC3ABqLXgxpNrKTl8Vrp4TeXBtMbPcwpEbsGl2vhQICnvGC50XUXqCWjnD3l8gzfkb/JPPw+XEW4FwB8C+HHe9FcBPAfgu/BpC74InwrzFlzulQTABw8oniW8+d8D8OsAfhnAH5PHFwB8P4DXyOMFBWiDfnOMAPh3AM4CeAvAJ7lIFwF8k+d7mudc4/90hSD0+3BZBe8D+PdwdrVX1YNiG8CX4DIWnuZDYYH/37cBfL4L1zQmT/+BKvdjfD8Nl/nvTfgI/hzneAoWzzUQdNBdpCgQY3cIEM8D+BOOe4o3+P8G8DNw+WMm4NITVAH8LgGmwRt0HcArAH6NQNE4wPnUAbzMsf4VXAKoi1wMd+Ez5f3ikEkx0wD+gMDyZfi8vzMEhLsE+AJc2tIfhUtj2uD/9mW4DIG/Q4Cp8v/L8/g5AL9NSfMyXFKvF+Cy9VXgcgr9Enwun/0+pArw+Y1/j/eFJPna5QMjJuCVAPxLW7o9oahF+5ElnKrDpcD8NXgj79copl+BSzVZgs9gV4PLVPdFuMxtkix7DD4J1DhBYQHAZ3ij1fYJADkFUqOc602qByWqCFsAHuZTchgARpJ2fZMLcIv/yTpBYIGL8jLfp/kQ+AwB52H2e47X53UuasAnbR+lhLPFPs/zmpa7cE21GvYVzn2GfExzPMkRlIevVvFxk2C6KgUX+ID5e3AZIHPIzsl0YIDp9IauExz+I2+wKvz+eQ0+Q51MJEm18zwurTZRXdl0tg4ovYi4XVSq2w2C1ST5lKoBuxguQ+8ImsutyH8RKxCK1WLdgUtrOsbfS+q3Opoz/OmsfIBL9zne5Wsa8xx0ZsN6ys3d6JKdzigdYH6O669r+YkOY4Opq9daC6STE0hUPyA7U118SJ4q/CyGzwYBLlagFh8CxPqR1jp4sghtwSdjl0Usqs1mB+LxeA+uaZ0AJfNtdABIRt0DmBg98OI9DMBE1NGnOlRlkjY6Xi8v3nHMOyg31kGujV3T4bsP8uhR+Zz9GnnlcwXAr6I5523HelmHuh16NK65vPcnb1mlee269X49yZquosuhAvs18mrU20Kzo5zun1UCFiknlgT2g8P+4Vpc7xT8cthb/jYO9P4svuMAfLPOExnnjIzjc0gva5sc8hp1utiPegyrbHn0FJom+iIWSQaaDL7rCepoLtVRV8bXfAbjsqMUtZkXbYCoTiPmmLL9tLpINSJ3MbApyA7GiAKfXLAQavClUUo0PhbUuUJdAyiJT8bYhDdMh2Nvsb2Qoh8P45NYtqQbJsEcmQTTCO6tOrq8O7ffXaQsqqnFHcE5fa3DOdw9AbeN+XXabO7A73Top/fTcD4a2wFIiVeuvgCFFKQVsBiHc8T6NufPK760S7pc4Gk4T9EX4HZWiuTh0/z9q/C7LTV1bAXAJQDP8Jy+C+BzcB6ubxOYCjTAXuC81+FLl+Tgtu6X4LZlb/MJIoD1E3ClbG/ynKI2erSWvAZpC7fO++IROEfBGJYY/Siv/VYvJ8h3YYwGgI+oJ/UdOAev81xgc1xgb/BGusyFfwpua0wcup6A25lYgqs5PcV+s3BVGqVqZAPOvyVrW/Rn+PsvwDn1LfCYKf6+wgV7G75y48cUMH4Xzu/jRwkIp9nnLoAfgXNEm+X8p3g+r/E8P0uQ+F4435IGgL9OUDnDBbQG71T2EEGqDOCH4Dya5wgqn6GE88NwDnCtfExyCowHaXcsUvdhoh4E9UDaTVM3Q3DttK2VynqUY/Qjb30HMFJ18RzVknOUCN7gYhV/iXW1cK7AO+iV+Xmbi/ijfB9VktUZgsQn4X1lFuGL0qcBnlSYvERwm4crXH8azmv1r3DOt3kOV5WUUCW/o3BOaGcJVF+Cq7ktpWNv8rdFgukzcNurHyUYLJOfH4ZzIlvmbwnnGCOgFBXAnecc75OHT/HJ/mW2FZHuBvA0z+0Wz3NQtnGTFBtTnddXSgbnAhU8C6Q6bYvatB3VGP3AW8+lxIMaeUN7y1ku9l0ukFcJIDN8Yk9TZXiHT/zrfPqL+nCDN1WRN9WEWkwRvGfqLKWTZTTXv06UCjNGHm5QivktAtQpjnmf53wfLpbmHYLEFud9n+M8xT5lgsk5AH8XwL/muVR4XmMEq22CqPD/Js9/Dj5gMA8f/JlX6puu2w1+nuWYEvS3FthpkgBUtTQzKLYEUa9n4UI6rvH7B/mguRncB2aD6a4NJoH3feqL2tRZE1TUk0i8SneUNCF69gbbS7yRpGZ0Ed4LWFStJFg0NTVWQYnVWUbeUXUDQ9lcJO4lVjs1dTW22Eh21GLNsb0SiJe1YDeppkBDvGMraK6dnbUrFwVGZp3Iq4DmFKXDsr2fBTAfIChfN4AZbIDphg1G1CRtaI3gC7vLPBtcQOPwzj1QOz0aMEopJ1UILkxWjgqZo6EWfCgijmQcW1C7GGFYQy1Y5HW1wxQrIBSRXmwIBWRvl3ditI32aVcZRAOpthnkKX2WsDdvTafjoM01MCPyEVG3qwpo/47wD4wz/vhW6NpKb283f4NqlTgQFdRCFWmhHoCbBF7WsdefJVISzzjVH4nnkZ2f8/B5TdDmfJMWrzT7xLCSSL2TVIskJcMm/BZ9NbAridSpd8wa7JdD825a+JCAOrbVPdUuyVLUoq3b4/aCN6FqL//cfA9vmv0Aw34ApN0TTAy2OwRPiaa+DrdDJIZfieiOCQplSmIb6s8YgdsNqtJAKzf6CEHlopKQ5Leb9nQ8sASjH0aick7xQXFNqY0l/geLSqoc5//xBprdHApKtb1CEJvmeK0y8Q27kfdI6KD5YI5LZ+xkXElMtIHmQK4duN2kIp+OE/CRo9tsXwmMrjHc7swav0uA4CqvnexojWU8Vc1hrL0NptXTX7s+fIigsqOkxseV9PkOfPS8AP0jNNYv8n4owkf154KH1n6uWyNlIXfjumWN240xDvIf9YUNpt/orZQbNeFNJbtH78HtfN1WqmIde1MeSDKsaTgHulP8fQk+QCxWwBK1UBGNDibZ7BAcSnxNEEhiSjeShGqX/+dZeAP+Flx+oCllH5vk7w9y/GvKhnhQiatXktxxjdH3KtJxUponqNyob/CcZeu3gOak09o2JUBxU9lnpBaU7BDlDFSOBGSK/L/00znmg0KrARPwyauLcO4MS+wH9T9J0rQG9hrhD6qeG6XQsJaOjTKAJ4/mHZ9OUD+n+rZyY7dAvYPb60bhjbxxoDaFVRKi4L9pqN/0Tl+oKsTB/yjZFjVgNdAcCxUm3UpT6czIe8IkmE7/lKTDp9NB+hkd/oEgksYMnPH2TQUqRTij/D2qrRPwWRO3+F88ScmlRjX3PtWpcXgnxkmqSOLLJfFjG1SpZVewrFSpKIN3M/KeIIAxGvwHgkgVm3B2tQ/AG9Nvwe8ujVAtOkVA+AqBJ4azuT2N5rI6r3LB3SHoiKf1JpwheZ4AswLvezUJ79xZw3DEIh25imSxGt0bw3jrbAwxqI8SMJbQvHUsv28pyeIa3C7eFNwO3za/b8NF48/Dh6bUCRQLBJP7tMtMwgWvbsK7HEiM2AKBZAfN6TVmOd5Ginp92OsWtWnrxhhZ/1G1l/eFSTBGg0AFqjsNZUf7C7hg1Zigob1+c3DpN3QRPm1LkRCEEkFHjrnPPrdTQE5XwTB12FQkoyEjMdLW4I2zawpAZNHfhve2FuNwRUns8i6OkeJuUEezEVioocYwQ/4hVCQjo+Oyv4xh7y4S4I28jxEIxLh7Gs7fpcLjThFQxiiVjMI52W1RDboCnw6yQHVH0nNcgd9BqhOUnoBP97EKH/0+jGS7SEYnAmTS2mI4A+x3uOgFQKTc7EW23eZCmYYPtL1N+8p1gtAonKFYai6tsu832P8MnM+T2IBWCGQj8N7eofFUfzYjrwGMUZ9SKyOiSBUiSSywvazu3yVlJznFY8r8/Anab3K01UzDZRJ8Dz5zXhW+FpOoXJJpcZLvb6I5dUTIp21TZzB12HwwaW1WtsR462QMoDkfzJvw3tGho5kATTFo12k2asETfYRAIeAkZoERSiQ6GX0Ne1OIiPOeDh2JYflgOubNJBijfledxJNaHOFkwes8PJKOY0zZFKTig+wIaYloTQFGFT7/jyRJE0km3y+SwKBSPkUPTtq0oYO2boyBPuYtMd66NkbaE1LneJmBS68h0exrcF67ZbYVFIDMwqXkyMEFM24QaObg66SvwweonqLKVVASVIPHSSL611Iko0G8Zw8y16F5MwnGqF8klSzpZQXOKe7jtKHMwSea36KE8gycgVbiiHbh8gJtEIgm4I2/9+GMt4twwa8fpT3mG3BOeuOcU2wvocPdsFQVOHIJxsjoOG2BWW1iY3lJqTQCLKA08nX4mlhX2P4CfFrTDTRX8RylJLROsLkBnwNIckNv8PuIUqMs4dQB/lgz8pqR97h4E1tJKyNv+JTeQXPhPW2clUqcgK/MGdpSxFicU+qVTvoONEdpp0kCZuTtkLdBqZ9jZCQSxBl4X5Yc3LazzmccK0CRMjHiRNfg9zn42ku6JHCM5soOrXJDG5mKZDSEdpqHaD9J4AzAE3DR1ZLIXaSPRao4m3Cli0fhoqzzlJhW4IzGL1PqiTuUEoz2QRYqYNQPwNEq4ZT+HMFFTJ8muFSo7sxTspmH2/WRlKg77PMIXPT1RY5fJghNKMklLEVsVQVMgjEaIvWnVVsUgNENSiCb8IbcKf6+yu/LBJc8XA4YwOeTKROY7vO4BWQnkgq/W8IpAxijAVV/wjYNLKLCSKXMe/BG2i14V3+5p1fRbMQFQSlBc3qHZWVryWFvmk3hrYbmnaiQT9umTqH4mFHUEk6dbN6iFhJLWumNBC5rXRHOUDtBEKmpfnWC0AV4420NzeWIxbgrxt8CxxXvXskBs0sVokr1a4zqWRKcU6tkT1Gbtk76dmOMg/xHh74vTIIxGjRVahq+oN5dOH+WcapLsrtUgo+AXoTLzztKm8w4P99SKpNkudshyNzjPFc5xxZtPHdo27kPn3zKqAWZkdeoH9SjToy80n4DzblxZ5QNpgK3Q3Qa3t9lA87Xawy+jtImAaMMX1PpBYJPierVDFwowTRfksbhFMedpsoVt1FbsI+2oTPyakc7I6PjoDrVHSkPm+tArRcHulH4iGcdaS1qzxSB5E1KOhLQKJKO2FMaaN6p0ipXDj5RlSzYMtvvdMBvv4P7Zi8nMBXJqF9u9LS2NCPvDrwxdhvNOXe31VgVSi834X1kNvm+pY6pK0DJqb7SLrXHtziXLjE8iuY6SmbkTXka7Mto0w3DT4djoI95MyNvd8aIUj5nfRfguARfCykJJBhJvzmu7u+6epiOwUddJ/Alf+c5rthUBEgeg08VMQUfYDkL4DJ8ueG08zYjr0kwRn0swWSRZJubov1gCs5IK3WLJN2C7C49BOBr/PwpOEe8adppJtUCvEVgysH5xZQ431V+nuS4V+AjtxuKJ/P4bSPBGBn1M8lT8TU4I+ws25bgc/GKvWQOPkl4Ac4ILPWPZGND6pWPEFAk74sAToVtm+x3g/0m4XaZXqEUM4vmfDFGwZ9mRl6j46SDGHnlvYbm+tGFQGSXVJiPUgp5hX2kbIkYg0NbRSNFxdLBlNJXqkJWsHfnZlAkRzPyGp1IFSnNyNtAs5E3Dha8LmbfUJ+vwUdS17E3LUMjAA8NKOKMVwoAKIJPQK4BKp9xDp20DbWR18jouNWfrDZt5P2AUnE0sDSUdAL48rGiLpXUWKHxswDn9yISlQDXLpwB+PGUxSrHluAMxHNwzn+1fZxX2DbUsUiWcKp7YxhvnY2R9UTOSpMQw/mznOFLdnEmqKrU4esjFWlDmeXin4HbVn4brs7Sp+CTU43x/V34InCbNB+8QpvPHKWn+wCe4m+L7DfK92m4SO60a9WP66ndXIfmzSQYo0GSchKCgBheR+E9c9fgEn7X+P11ftZhA+9T0nkIbkfoHkHmDoC3CEqTBKF3OcdduF0jLd2swxV0G4c3IE8RnPLHqZL0459mKTNNgjlOCaam1It2KTPlOPHClZpHDTRnoxPnO22klblm4AzK7xBk5JgCfNa7WNlx8ik2jXpwHmnhApYyExaLZNQfBt4RZMciiUNcLri5Y2XwzSu7SIy9qS/lVYBzlLulDLI5ZdwNDce5FF6B5i3xqI0xFvtoG7pYJFORjPrZyNugGnIxYyHkUhZcq4Upks1oyr3fyRih3ajdAj7xRl4DGKN+kWKygGcXPtF3moRwkCd8Izj+JBYWPHKAsVik7o1hvHU2RquEU7IwSrQTnIdLIlVF62RPvYr36XVskMUiGRkdA9XgdmzEQa6wzydyp0bLdhJCeEx0gD7txs3yBh7YOCerTd2bMYy3zsfIsoGIZ+029kYtR2hO0yDbxzoxVR3NLv/h+NKWU/20bacRqFKSCzgEEeEjCcZFML+sN6lOKcZkHf9UQ7M3cYRmT+VO1MJOjLxWm9roRFGWNFCHc5R7CM43RVz663BJnzb5vcjXGTjnuhjOkDvHY+7BV3KU0rDb7Cd1lh6A2yavwwdBPglXv7oO585xT4GAANFp9l+Gr2Wd42uM70vw+WtycJ6/DTinPQGZOlw6zjX2GyNP30a6I+JhVdkjl2CMjI6LslSAGM5X5TUAn4XfrpaYJKlT/RCcB60ENxYBfAjOIe4c3C7UGbXQE/j0Cwvs/wpBaZxj1uCKsj0Kl7JhCc6l4zKPke3xLThD9EMEiJpqAyWfB9j+pwCegcszc488FDj/PMFlGc5p7xZ5EuP2Lvb644TXsO9ikczRzhztjpM3sbG0qk0tuz7nuKBPETjWKKFASSQTBA05dlONn+eiLnKxTvOYKYLH+/wsGetyCjjGKOWMEIRW4PMBb3CsNQLgGAFmB74GUwHNAZoiBRUpmUnM1CKPH+HnuwCeYP934OOpBsbRzgDGAKbfAUbbOuQl9otGMJ6oMhEXZ4Rmz9u8spPU0OyMl1fj5dQ8VXVsWu7eOEWtiwNbjERjS0WCDXWOBXVeuYCHNG/kgfLkNRXJaJBsNBH2xvpEajHn4eKGEqo6dWUg1mpDFc3pMWNkb/vGgWFVp4MoKpCMFZAAzWkdBJzeJ2iUAwktp4AmFxhzaxjguCbbRerNGMZb52OkPSH1k38Wrnj9ewoMEqohc1Rj6goMZvnbe1RnRqjK7FK1maQq9DbnGOcivkSDrqTcHKOR91005+8t8feLtK8ssm2Lx8xznrdSVJoimh39QgkNGZJClHINu7Ge0Ov7wiQYo3418sqTfQ1uJ+V7+X0WPqv/hDKS3ieIFGkg3SCwfIyG0024XDIJj79KSWISLiHVt9h/DD5L3fM0Fp9hvxX4etcNjjlBkCpyvC8RsOY5Ttr2+34NtMjo3/dGXssHYzaY47bBAK23XWVnaIN2lTx8ioTnKKXIlrV4+Y4B+B62vch36bOqpIk8j9klX7to9qmR317le43vUrVAVKSXAXwYPpdvBBcd/ipaxzOlqYCt2ro5Bjr4j8wGYzQUkkurJ6wYZV9SNpURZbjdDFQJEIx24XZyNpQkpB3xQie4EnydpSJ8is3XAjtIrEBK+M8R7HRU98uq/4mtOGAAY3ScFLV5mmoD6KZazOKwpm0veocJVIsa2OvBqousJWjOyVuAT+mgDb+j8HWX0tI4CGBVFe+hcbgfNQIDGKMTaYfRRt5pOIPqAprd8qXm9A6ay8DOUsK4RvvIHJyfS562FLGhrCrwysNltTvPthsccwPOU3eW6k6rOKg0J7g0t/0syS3JsKe0OrbVGOhgXAMYoxNNAgTPA/gM2+Ypncj2b5mvBYJNntLONoHhA3AOdlNoLvW6xbZ3eezn4Dxtl+Gc6yTH7ymCUqeLM2uxp4FOtE/JDi3G6MSQGx3HH2hk1O+Ug9sOvsNFMkn7yFsEl6KSZCQJ+Cfhdn2+Bu+0tgXvnzLCz8twRuH3CGZF2mtE0lmk5BN3CDKtMtt1Un6k1Rid9t0PbwYwRifOHhOqBzFcXI7s7CyrfhspY+wQLKTKANDsNRvBG2pjSjzfgTfSiqdtgZLMRnAsWtg0ooz3sK1VJYV2/dJ+izqwt0RmgzEyyr5XpZriqlKHtF1Gu+6PUE2qqWN1sqppBTobaK4vrdMvRC0kECMDGKMhIVnkF2gXKVPlKcEZe9+k6iQR1tNUb2pUlSIAH4T3hZlh3zLHXVCfkSIlHKlxdJh024kORbpWIi16MEavxrWUmf3FWwPO+BpWFUCGevAeAeYCQUKinscBPAK/8/QNfp4hwJTgjLeTcE5wddpbxJ1f0jSEgNYqSVY7O0e7MQ5qgznozlDauNVe3hcmwRgNmhQzCmfsvU01qKpsKa8oaWOM/Rf5m7j+R5RUxJ9FjL5TLWwsRqYiGQ05yVO6Ap8OQXvxNtCcTlOc7rbR7L3b4Bi1wOYSSk9GBjBGQwYgabaPNBvMKnxsUJhHRTxwpd+mOr6mPs/DhwOsBoDTyQ5QGvilHWu7SEZGA0TjcN6143AOdOPwJV7LcD4sa/D5dyUbXQ7AR+B2jFZ4XIUAU4ULpCzb5e0umUhoNGgSznfhDL3rcBniZggoSwSIUUonL8H5y5QUAEmKh6sEnikCzTRcnlyzv5gEYzSk1GmsjuRrkWz/OoHTe/CBiOP8TSoKVOBSN4gDHVTfCG5nqtGBmrGfeJ/97CK1i0VKGzetb6e8GcAYGaUscnGwE2OvgEsDe+NyanBG3hKa8/Nuw+dyEVoPAEfy0MgxJdguk6lIRgOvAunPacXmH4Pfnq7CZ+6X+CQpuBbTVvO4Ag7pexXNO0/SX+oTSe2ki1SfHmkDLlm8t3plHZd2/hGyy+Wm9dnPdTUJxshIPRDrcLWJztP2AtpdlmiPkax3E5R2bhJ8IqpLMsYn4Osa5QlCy/x+Dm5nSSQmAZ88TngCKZNgjIZdwnmDYLJGYNmEy9a/SjAZhXegu61sNTLGNtsknukUgWOBQHQOzcnCt+BywVyhNFO1v8IkGKPBo06NvONwSb1vKNAQFaiKvWVNTsFHXEu/MbjdKGmTNA/X1ENXStLKVvcKwSzXAe9m5DUJxmhAJZhtNHvgisrSUA/MmrK5VNG809SA9+7NKYCK1XoQB74tZXu5B+fcZ2vGAMZoSCWcBC4iWgrblxSAaAPmBX4usp+ujDjKMQrYm/u3oWw8M3AGZS3tm/3FVCSjAZdQgOxaPjHtL6cBPEUbyw5cgfoXqfZ8iqByGW7HaIeShyTuvg5fA7pAu80FuPpH96gGSXG18UCFAixUwCQYo6EFoATOoLtDO0wNzhh7j30uss8dfn+fL6nAKAXq34Pfkpb602/BR2sX4Lx8CwSfS/D1joxMgjEaUhUJlDwkXQOUfWUOLnTgddpYBJDycIm9tZ/IJCWVLapRy3wlwYM3gU/7kFYTu5V3b8h7ZABjZHT8AAKk7yLJgt6FN8rqRX4fzgemhOaaRrpWksQjVZXkkg/6hrysobmAvfRL1PpJq8uk1aoY2TtKFipgZNQnAJQAeIYqzqaSSi5SqpF0DQIG4pV7jt9vUAWaZf9LlIQELMbhwwJWATwAXx1yBb7c7DScI981+JCEPH8XqeghSkUTcOk8iziBBmIDGKNBohjA23ApLx+j7UUy1E0DeJhtW3C7QMtwHr/XCBxbBJGL/P0ifJ7eKoHlLnxplAcJZjMAniVAbNNec51AtcM5rxKQVij1iCQ1bjYYI6Pjp3a7SNK2TECRbHV1qk0jBJJFqktzbBMbzQhcXFIMv7MkksUG22TOWf7+TUo843C7TRUC0Cp5KinpZYHgItviMe03uRb2G0s4ZWTUZzYaqeJ4F82GXAlyFJvKbfh0DuJM9zDB4R00lymJ0FxYTdSmHFyU9U21OPNK3VmCT/+wyLbr2Bt4mMcJNfQawBj1G4Doz7Iode2jBM2GWV1WRLeJp64eU0IBysFxYR6YOGgrtegHBUahpCFG3zpaG2gBCxUwMjpyalA9ET+UcMGFr0aL30T6yQfjNFL6NVLGbaQs7rTF3Eh5B06oB7ABjFG/359SpH5cqSb7UTWSALBwkhe8AYzRSaWsomySInOerxraJ2Lab1KnKGMsoH1Cp07HtYRTRkZ9+ADchtsqTuCrMTZSFkySsaiSFos6XIihChan2D4s4NEAxmiIpBrxutUpGApwRtVaYDPRqS8LCqSknwQu1hXoxMGxsiskdZRyCmQMXAxgjAaU0naRanB+JQ/BBS1egPPGLcHZZDYIAPfh60xL/NB9gsYmnF+LVIIchfOulZwvNb5O8fd1AE/CefpKgbddOMe+dfiUnK14t4RTBjBGA/IAXIVLxfAJOO/aD8DVPIoJKuKWX4LPyXuD/d/g56fhUjxswHn8jnH8Tfg8L9cIMlMAvsq28/A+MFMEHbNbGsAYDZlkU4eP+5HvpyhZiPt+ndLJupJaqgD+EqWZ23Db1O+gueTJJMe5BZd3d4PfpUqk8LBCyWfDQMYAxmgw7S36s1YLcvDBjOJ0t6BsIvK+qu7rb/PYTQJFBT4IUttSlvheohomyanqarwYztAcZawZSziVQYbERoMCOgWqQ9NoTp0gJEbfEfaVuknLPE4qN4oBN0dQERJbS5ESUQ3ewDymJCdLOmUSjNGQqkqAS4+5QaCQKOgpAsMifMnYu5RaNuDSNZSp5kwShCSOqAaf8FtAKuKxoxw3RzuQrRcDGKMBBxD9OU09+BZcPt6nCShyH8e0ofw+geQR2l7yVG/qAD4PHzU9TwlGdp8alHYKyp5zDsAfEKwuwHkVb6ZI/raLZABjNATqUkJJ5F24qGUpFSsqUUQAKRJkqso2kQfwAnx6hzG+ygSNMlxel1O095yhpCM2G21UNjKAMRpge0tWVQHA+69IlcaQRLrYUt8lbcMKvFF4iRKOTncJtpfhtqdvcZ4i3C6WrBmrKmAAYzSkKtQc3Fb0bmAz0YmlJEgyIrhMUcpZhU+rUFfqhjjuicfvplobum5SApNgDGCMhprOUxKRQmlSi7oOn3hKVB6RPipKXdqFM/xegvNrWYDPYrfEtpcUULWSNIzakG1TG/WbhKI/p4n7zxFQJuHKlDxN8BBgqcPl2n2MdpQtuNSYb9DmIve82GA+yHHGCC6Ss3cCexNFZUkwWby3emUdl3b+Sca4WX32e11NgjEygo8zkuoACYCX4Y2vDSWV7MDXppYsdkvwpUpe55iSt7dMFekunK/Npl1uAxijk0O6LlKedpgIzXWlJaBRp9gUO41+8uv0lyL1rChVSEIEZFwjAxijIQCQEEzCvC4JXGDjIlUfsb0klEREVdJpKneoKhXgtqF1YTQhKXtS4feVFPuL1aY2gDE6ASA0CmfolSDFEUocE/Dbz1MEmSKPW2bfWbit7TUAT8D5tixQwpnisZNwgZFi5G3AwgMMYIyGwr7SiYTzIpxhVqKlxwkCO3DpGubgPHBLcH4uZbhdoVW4naNtNVYNwGVKRGV4D97LcDtNy2iuTGBkAGM0RGCT5ko/SknjHu0wch8nAF6j1PIiXDjBTfgEUaMEEtnOvsZjiupdHO5mCFhxCj/twNFCBQxgjPpQ9en0xo8pmQDekFtVv1XZ9i34AEZRc6qBDUL3r6o5xIPXjLwGMEYDLqmI81tNqSPtjKD5FIDSxdBk2zl82us8MFHQllZ4TfcbRiNvwwDGaNgpB7dVfE3d9O0WClIWWdKirRtj9Grcoxojrc0AxujEqEg7GdKEAUzvACY2gDE6KRSjde2iVm2dFhc7zBj9zBu60NazP9XIyMjIAMbIyMgAxsjIyMgAxsjIyADGyMjIAOb/03EHhkUDOEfU4fhRn11rI6OeAEwCXzQ83EKrpiyAKOOlPREle5iE38s8dc4jv0u8SNrYUPOH/RD0S+MHbb7rIDmkjJvGm26LUs43UuPp75LfpK6uU0WNVYdPL2Bk1JeUgwtzD8EALdrkuFm4kPaNYGGcgw9CqwcLo8E2ydlRhHMTl5yoG3yvcKwyXLTsBOfcgAtEK3GOWC3GGpxfzzn2m+L46ykLVwAyUbzUFM911a+u+JY55jmuuKJL5jSZc0OBneZDe6rOsq0Ol7JxFz537Bn2WeNc4u16Cb5E6hxcQfe1FEDEAf7Tdm0n3ddkGP1ges7bQR3tEgAPcHGM8EbfhPPGlFoyqwSGdbj8qPLELSoJZQIuwnWMvxXg83Cswef+qMN7eV7kCUzABb1d4LESmHaBY5xi+wSBYZnHbnG8Cfh0inIttsmDrnU8xf5F+LwhRf42zr4j8AXZRwC8Rd7zBI8dAkoOLgr4DFzeEUlYfRbA2wTUBn9f43gXONc0r/koj50kL3dgJU2N+pQOAjDi1i25Mua4KCfgqund4w2/A5dX4zUu7Duc7zwXdo0L+iwX1nV+Xme/kWBOSS40ykUtUsxpfi8S5GpclAIKI/AV+R6Fz7V6iot4i8fvchEXOPYOfN2cC2wTKeg2+fgIz6sMn9u1Cl/L+DK/y7lf5Xy7HPcsQWoZLlOblM6o8PMMr9E4+d0kD3PwdYFEjTIy6juKqFIA+4t7SLjAGkrsL6hjpHB4mQs1r9SQInz+Dj3PNBf0LEFqm4tW+u9ycY6rY6twmcleVzalAnxkbl2pPQl8iVGx0chvOQJVDb4ioNTWeZwLe5H9cvy9QlDYQnOC6JjAVySY3oUvqF7gedQJWGPwVQhjdT3zSiJr8LvYlopUm+4oII8wHDE1xlvvxjgW3g4KMEDrMgl6EeeVigO1iMLw8jD0PE4xmupCW9qukgvGiTMMwY3gPcvQHAdG2iQYI6dsLLEClkQBBALJIlLXIwl4idV7mFwo7Vyg2mJbxAYw/Qowhwl2jDuYNKf6pkVwtmJcxskF/cKcIUW03i1CAFqhQVTzm0/hI04ZV8+NFlJeLmjLBdcP6vyiFn9W2rmYzcWo72kYHO2SEzq3kZEBjJGRkQGMkZGRkQGMkZGRAYyRkZGRAYyRkZEBjJGRkQGMkZGRkQGMkZHREZD2XG1VRzfNoayBIXRt7tIYxpvxNoihAlne4UmLtpZ4cZhQgVHFWDjxftrCAuDRMY1hvBlvJ5m3BC4gt6ve6YcBGEsRYGRk1DHA7Fcc27UnivFmvA0FbzqodqCiqVuBVNRhWzfG7TZvB9XX+423rBsUgfpr162/eTvsesrqd2jSOXmNTh5JnuEwr4zcbDU0p9pIu2ktdYSRAYzRnqeXpDmdJ5BsKtCpw2UjnIJLqrXD/mGFhxx8QndzeTBqaYMxOjkkibSehEv5WYbL/1vgbztw+Yo/BOAG+8zDpfZsKLApsG8M4JaSeCxPjtEeCcbKLHRvjH7nTbLxTRIYHoRzO5iArxJxm+9F+MoM03ApVkcISvMEHMmnXMmQZKxsyQldTybBnFw1qQbgDUoiL6I5TamoSi/BV0CQKg06Pal2rKqYmmRkKpJRogCmAl8YT0s38nlXqTzyPQrULOkft5nzOM4zqy2CqXFHriIZHZ50tYJuiJv1fUgF4ZZyOxVJJ0CP0Vy5Qe8oxeo97XOC5uToUXA9EIBUK77lmLS+UQfnHlZfkOoNcYt+RgYwfa9uyK5MmdJAEqgPSbDgwqd/gr1lYBpwuzi7wXFSraCRMk8EV2+prhYXgs9Ac7E2XfplDM5dXKiI7JrhsnDL8FUyZctbFrBUqqyjuVyLHlvGLKhjZuF2tXRpF6RcHxlfrsU4mssA52kf2kVz9cuJQGozMhWpr6kOZxAdh6+VpJ+cBTQXuNdt9+EMrGUu8l3VTxb8EnydbqnZLepLAb46pQBcTYFeDntrMIn0scC5RxTgzXC+KSWtlNTCleJxCVwxukfgS+qKupWHKzh3Fa7sbV3xHClQkIfcLR7zINyuVIn91xXw1RUYljj/LvtP8Lc8fAniTfi636MKJAWA101V6j3FHYjp3RD1DzIG+pi3NPG9oV5FtYjH+V6Ar0VdIBBJTaRRHiN1lqTqY0WNNaIWntTilgfECNyOUJXjFdUYMveImltAIIKvnimqUV49fAoK9Arqt3Eu6hwX8rIaA5xXFrn4y2yzvcS+Aqg5dY12FECU1LUoqb5Fxbdci111/eQcZbt9W/2W51x5HpvAdpF6ytthKjsOZSW6Q44RI73ao5Z0coFKI9JPBc7PJBeMnWZbQEqfUPWKUlSKOEXVmKMkkqTw227+KMWeESvpJPxdV6lMMvjRFS4b5G9DST96zFDVy7JDyVi6ymhYQdPSNfS4dKzR4Skr0CwNCKIAZERqaGQslKxjs8YP//Cs8TToIWOMVm2trkMW/53yBgUIcYtrE2UARqtxE7O/mJF30Iy9WaJi1KZfDntjelqpY2llctPm7KQtbsFbp2Ps9zrsZ9xcG/46GRdtPhsZwBgZGQ0amZG3N2MYb8abrSeYa7eRkdERSTBGRkZGXSWzwRgZGZkEY2RkZABjZGRklAowZvXu3hjGm/Fm6wk+wlWok2ptEfZG8HZjDPRo3F7whj7ibb9jGG/d4W3Q7tlj4e3/ARLEtkl1Ro4PAAAAAElFTkSuQmCC";

// ─── Construtor principal ────────────────────────────────────────────────────

export function buildFloraKraftPDF(options: PdfBuildOptions): string {
  const {
    title,
    subtitle,
    body,
    config = {},
    maxWidth = 900,
  } = options;

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const logoUri = FLORA_LOGO_DATA_URI;

  const companyName = config.companyName || "Flora Botanics";
  const footerParts: string[] = [companyName];
  if (config.cnpj) footerParts.push(`CNPJ: ${config.cnpj}`);
  if (config.address) footerParts.push(config.address);
  if (config.phone) footerParts.push(config.phone);
  if (config.email) footerParts.push(config.email);
  if (config.website) footerParts.push(config.website);

  const footerLine = footerParts.join(" · ");
  const notes = config.defaultNotes ?? "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Fundo kraft / papel reciclado ── */
    html, body {
      background: #f2e8d9;
      color: #1a1a1a;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12px;
      line-height: 1.6;
      min-height: 100%;
    }

    /* ── Wrapper que contém a marca d'água e o conteúdo ── */
    .page-wrap {
      position: relative;
      min-height: 100vh;
    }

    /* ── Marca d'água: DIV real (position:fixed falha na impressão) ── */
    .watermark {
      position: absolute;
      inset: 0;
      background-image: url('${logoUri}');
      background-repeat: repeat;
      background-size: 180px 163px;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
    }

    /* ── Conteúdo acima da marca d'água ── */
    .page {
      position: relative;
      z-index: 1;
      max-width: ${maxWidth}px;
      margin: 0 auto;
      padding: 40px 48px 60px;
    }

    /* ── Cabeçalho ── */
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #5a3e2b;
      padding-bottom: 16px;
      margin-bottom: 28px;
      gap: 24px;
    }
    .pdf-header-brand h1 {
      font-size: 22px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #2a4a2c;
      margin-bottom: 2px;
    }
    .pdf-header-brand .subtitle {
      font-size: 11px;
      color: #6b5c4a;
    }
    .pdf-header-meta {
      text-align: right;
      font-size: 11px;
      color: #6b5c4a;
      flex-shrink: 0;
    }
    .pdf-title {
      font-size: 18px;
      font-weight: bold;
      color: #2a4a2c;
      margin-bottom: 4px;
    }
    .pdf-subtitle {
      font-size: 11px;
      color: #6b5c4a;
      margin-bottom: 24px;
    }

    /* ── Tabelas ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 24px;
      font-size: 11px;
    }
    th {
      background: #2a4a2c;
      color: #f2e8d9;
      text-align: left;
      padding: 8px 10px;
      font-size: 10.5px;
      letter-spacing: 0.5px;
      font-weight: 700;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid rgba(90,62,43,0.18);
      vertical-align: top;
      color: #1a1a1a;
    }
    tr:nth-child(even) td {
      background: rgba(90,62,43,0.04);
    }
    tr:last-child td {
      border-bottom: none;
    }

    /* ── Seções ── */
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      color: #2a4a2c;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(90,62,43,0.25);
    }

    /* ── Badge ── */
    .badge {
      display: inline-block;
      background: rgba(42,74,44,0.12);
      color: #2a4a2c;
      border: 1px solid rgba(42,74,44,0.3);
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    /* ── pre / código ── */
    pre {
      background: rgba(90,62,43,0.07);
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-all;
      color: #3a2a1a;
      border-left: 3px solid rgba(90,62,43,0.3);
    }

    /* ── Observações e notas ── */
    .notes-box {
      background: rgba(185,146,77,0.08);
      border: 1px solid rgba(185,146,77,0.3);
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 11px;
      color: #4a3a20;
      margin-top: 20px;
    }
    .notes-box strong {
      display: block;
      margin-bottom: 4px;
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #8b6914;
    }

    /* ── Rodapé ── */
    .pdf-footer {
      margin-top: 40px;
      border-top: 1px solid rgba(90,62,43,0.25);
      padding-top: 12px;
      font-size: 10px;
      color: #8b7a6a;
      text-align: center;
    }
    .pdf-footer .footer-main {
      margin-bottom: 4px;
    }
    .pdf-footer .footer-gen {
      font-size: 9px;
      opacity: 0.75;
    }

    /* ── Impressão ── */
    @media print {
      html, body { background: #f2e8d9 !important; }
      .watermark { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 24px 32px 40px; }
    }
  </style>
</head>
<body>
<div class="page-wrap">
  <div class="watermark"></div>
  <div class="page">

    <div class="pdf-header">
      <div class="pdf-header-brand">
        <h1>${companyName}</h1>
        <div class="subtitle">Sistema de Gestão · Admin</div>
      </div>
      <div class="pdf-header-meta">
        Gerado em ${now}<br/>
        ${config.website ?? "florabotanics.com.br"}
      </div>
    </div>

    <div class="pdf-title">${title}</div>
    ${subtitle ? `<div class="pdf-subtitle">${subtitle}</div>` : ""}

    <div class="badge">Flora Botanics · Documento interno</div>

    ${body}

    ${notes ? `<div class="notes-box"><strong>Observações</strong>${notes}</div>` : ""}

    <div class="pdf-footer">
      <div class="footer-main">${footerLine}</div>
      <div class="footer-gen">Documento gerado automaticamente pelo sistema Flora Botanics. Não possui valor fiscal.</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Helper: abrir + imprimir ────────────────────────────────────────────────

export function openAndPrint(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup bloqueado. Permita popups para este site e tente novamente.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
