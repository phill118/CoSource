const aliases:Record<string,string>={colour:'color','target gender':'target gender'}
export function normalizeSourceField(value:string){const normalized=value.trim().toLowerCase();return aliases[normalized]??normalized}
