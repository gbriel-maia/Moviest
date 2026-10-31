interface Item {
  id: number;
  title: string;
  category: string;
  year: number;
  watched: boolean;
  cover: string;
}

interface NewItem {
  title: string;
  category: string;
  year: number;
  watched: boolean;
  image?: string;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface Summary {
  total: number;
  watched: number;
  pending: number;
}

const ALL_CATEGORIES = "Todas";

let items: Item[] = [];

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) {
    throw new Error(`Elemento #${id} não encontrado`);
  }
  return el as T;
}

const modal = getElement<HTMLDialogElement>("modal");
const openModalBtn = getElement<HTMLButtonElement>("abrir-modal");
const closeModalBtn = getElement<HTMLButtonElement>("fechar-modal");
const cancelModalBtn = getElement<HTMLButtonElement>("cancelar-modal");
const form = getElement<HTMLFormElement>("form-item");
const titleInput = getElement<HTMLInputElement>("titulo");
const categorySelect = getElement<HTMLSelectElement>("categoria");
const yearInput = getElement<HTMLInputElement>("ano");
const watchedInput = getElement<HTMLInputElement>("assistido");
const coverInput = getElement<HTMLInputElement>("capa");
const formError = getElement<HTMLParagraphElement>("erro-form");
const searchInput = getElement<HTMLInputElement>("busca");
const filterSelect = getElement<HTMLSelectElement>("filtro-categoria");
const listEl = getElement<HTMLDivElement>("lista");
const emptyMessage = getElement<HTMLParagraphElement>("mensagem-vazio");
const totalEl = getElement<HTMLSpanElement>("total");
const watchedEl = getElement<HTMLSpanElement>("assistidos");
const pendingEl = getElement<HTMLSpanElement>("pendentes");

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    let message = "Erro ao comunicar com o servidor.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* corpo vazio */
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function validateNewItem(title: string, category: string, yearText: string): string | null {
  if (title.trim().length === 0) return "Informe o título.";
  if (category === "") return "Selecione uma categoria.";
  if (yearText.trim() === "") return "Informe o ano.";
  const year = Number(yearText);
  if (!Number.isInteger(year)) return "O ano deve ser um número inteiro.";
  const max = new Date().getFullYear() + 5;
  if (year < 1888 || year > max) return `O ano deve estar entre 1888 e ${max}.`;
  return null;
}

function validateImage(file: File | undefined): string | null {
  if (file === undefined) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "A capa deve ser PNG, JPG, WEBP ou GIF.";
  if (file.size > MAX_IMAGE_BYTES) return "A capa deve ter no máximo 2 MB.";
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject): void => {
    const reader = new FileReader();
    reader.onload = (): void => resolve(String(reader.result));
    reader.onerror = (): void => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function computeSummary(list: Item[]): Summary {
  const watched = list.filter((i: Item): boolean => i.watched).length;
  return { total: list.length, watched, pending: list.length - watched };
}

function renderSummary(): void {
  const s = computeSummary(items);
  totalEl.textContent = String(s.total);
  watchedEl.textContent = String(s.watched);
  pendingEl.textContent = String(s.pending);
}

function getFilteredItems(): Item[] {
  const query = searchInput.value.trim().toLowerCase();
  const category = filterSelect.value;
  return items.filter(
    (i: Item): boolean =>
      i.title.toLowerCase().includes(query) &&
      (category === ALL_CATEGORIES || i.category === category),
  );
}

function createCard(item: Item): HTMLElement {
  const card = document.createElement("article");
  card.className = "card";

  const cover = document.createElement("img");
  cover.className = "capa";
  cover.src = item.cover;
  cover.alt = `Capa de ${item.title}`;
  cover.loading = "lazy";

  const h3 = document.createElement("h3");
  h3.textContent = item.title;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `${item.category} • ${item.year}`;

  const badge = document.createElement("span");
  badge.className = item.watched ? "badge ok" : "badge";
  badge.textContent = item.watched ? "Assistido" : "Para assistir";

  const actions = document.createElement("div");
  actions.className = "acoes";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "secundario";
  toggleBtn.textContent = item.watched ? "Marcar como pendente" : "Marcar como assistido";
  toggleBtn.addEventListener("click", (): void => {
    void toggleWatched(item);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "perigo";
  deleteBtn.textContent = "Excluir";
  deleteBtn.addEventListener("click", (): void => {
    void removeItem(item);
  });

  actions.append(toggleBtn, deleteBtn);
  card.append(cover, h3, meta, badge, actions);
  return card;
}

function renderList(): void {
  const filtered = getFilteredItems();
  listEl.replaceChildren(...filtered.map(createCard));

  if (items.length === 0) {
    emptyMessage.textContent = "Nenhum item cadastrado ainda.";
    emptyMessage.hidden = false;
  } else if (filtered.length === 0) {
    emptyMessage.textContent = "Nenhum resultado para a busca.";
    emptyMessage.hidden = false;
  } else {
    emptyMessage.hidden = true;
  }
}

function render(): void {
  renderList();
  renderSummary();
}

async function toggleWatched(item: Item): Promise<void> {
  try {
    const updated = await api<Item>(`/api/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ watched: !item.watched }),
    });
    items = items.map((i: Item): Item => (i.id === updated.id ? updated : i));
    render();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro inesperado.");
  }
}

async function removeItem(item: Item): Promise<void> {
  if (!confirm(`Excluir "${item.title}"?`)) return;
  try {
    await api<void>(`/api/items/${item.id}`, { method: "DELETE" });
    items = items.filter((i: Item): boolean => i.id !== item.id);
    render();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro inesperado.");
  }
}

function fillSelect(select: HTMLSelectElement, options: string[], placeholder?: string): void {
  select.replaceChildren();
  if (placeholder !== undefined) {
    const opt = document.createElement("option");
    opt.value = placeholder === ALL_CATEGORIES ? ALL_CATEGORIES : "";
    opt.textContent = placeholder === ALL_CATEGORIES ? "Todas as categorias" : placeholder;
    select.append(opt);
  }
  for (const name of options) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.append(opt);
  }
}

function clearFormState(): void {
  form.reset();
  formError.textContent = "";
  titleInput.classList.remove("invalido");
  yearInput.classList.remove("invalido");
}

function openModal(): void {
  clearFormState();
  modal.showModal();
  titleInput.focus();
}

function closeModal(): void {
  modal.close();
}

openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (event: MouseEvent): void => {
  if (event.target === modal) closeModal();
});

form.addEventListener("submit", (event: SubmitEvent): void => {
  event.preventDefault();
  void (async (): Promise<void> => {
    const error = validateNewItem(titleInput.value, categorySelect.value, yearInput.value);
    titleInput.classList.toggle("invalido", titleInput.value.trim() === "");
    yearInput.classList.toggle("invalido", error !== null && error.includes("ano"));
    const file: File | undefined = coverInput.files?.[0];
    const finalError = error ?? validateImage(file);
    formError.textContent = finalError ?? "";
    if (finalError !== null) return;

    const payload: NewItem = {
      title: titleInput.value.trim(),
      category: categorySelect.value,
      year: Number(yearInput.value),
      watched: watchedInput.checked,
    };
    try {
      if (file !== undefined) payload.image = await readFileAsDataUrl(file);
      const created = await api<Item>("/api/items", {/*  */
        method: "POST",
        body: JSON.stringify(payload),
      });
      items = [created, ...items];
      closeModal();
      render();
    } catch (e) {
      formError.textContent = e instanceof Error ? e.message : "Erro inesperado.";
    }
  })();
});

searchInput.addEventListener("input", renderList);
filterSelect.addEventListener("change", renderList);

async function init(): Promise<void> {
  try {
    const categories = await api<string[]>("/api/categories");
    fillSelect(categorySelect, categories, "Selecione...");
    fillSelect(filterSelect, categories, ALL_CATEGORIES);
    items = await api<Item[]>("/api/items");
  } catch (e) {
    formError.textContent = e instanceof Error ? e.message : "Erro ao carregar dados.";
  }
  render();
}

void init();
