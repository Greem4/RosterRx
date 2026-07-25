import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Modal from '../../../components/Modal'
import { useAuth } from '../../../context/AuthContext'
import { IconEdit, IconTrash } from '../../../components/Icons'
import { formatDate } from '../../../utils/formatDate'
import { rxApi } from '../api'
import MedicineForm from '../components/MedicineForm'
import { expiryTier } from '../utils/expiryTier'
import { shortMedicineName } from '../utils/medicineName'
import '../rx.css'

const SORT_OPTIONS = [
  { key: 'name', label: 'Название' },
  { key: 'series', label: 'Серия' },
  { key: 'expiry_date', label: 'Срок' },
]

function compareItems(a, b, key, dir) {
  const mul = dir === 'asc' ? 1 : -1
  let va
  let vb
  switch (key) {
    case 'name':
      va = a.name.toLocaleLowerCase('ru')
      vb = b.name.toLocaleLowerCase('ru')
      break
    case 'series':
      va = a.series.toLocaleLowerCase('ru')
      vb = b.series.toLocaleLowerCase('ru')
      break
    case 'expiry_date':
      va = a.expiry_date
      vb = b.expiry_date
      break
    default:
      return 0
  }
  if (va < vb) return -1 * mul
  if (va > vb) return 1 * mul
  return 0
}

/**
 * Действия строки: при удалении кнопки подтверждения появляются на месте иконок.
 */
function MedicineActions({ id, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!confirming || deleting) return
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setConfirming(false)
      }
    }
    document.addEventListener('pointerdown', onOutside, true)
    return () => document.removeEventListener('pointerdown', onOutside, true)
  }, [confirming, deleting])

  const startDelete = (e) => {
    e.stopPropagation()
    setConfirming(true)
  }

  const cancelDelete = (e) => {
    e.stopPropagation()
    if (!deleting) setConfirming(false)
  }

  const confirmDelete = async (e) => {
    e.stopPropagation()
    setDeleting(true)
    try {
      await onDelete(id)
      setConfirming(false)
    } catch {
      /* ошибка показывается на странице */
    } finally {
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div
        ref={wrapRef}
        className="medicine-actions medicine-actions--confirm"
        role="group"
        aria-label="Подтвердите удаление"
      >
        <button
          type="button"
          className="btn-inline btn-inline-cancel"
          onClick={cancelDelete}
          disabled={deleting}
        >
          Отмена
        </button>
        <button
          type="button"
          className="btn-inline btn-inline-delete"
          onClick={confirmDelete}
          disabled={deleting}
        >
          {deleting ? 'Удаление…' : 'Удалить'}
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="medicine-actions">
      <button
        type="button"
        className="btn-icon"
        onClick={() => onEdit(id)}
        aria-label="Изменить"
      >
        <IconEdit />
      </button>
      <button
        type="button"
        className="btn-icon btn-icon--danger"
        onClick={startDelete}
        aria-label="Удалить"
      >
        <IconTrash />
      </button>
    </div>
  )
}

/** Одна строка: название · серия · срок; фон по срочности. */
function MedicineItem({ medicine, isAdmin, onEdit, onDelete }) {
  const tier = expiryTier(medicine.days_until_expiry)
  return (
    <li className={`medicine-item medicine-item--${tier}`}>
      <span className="medicine-item-name" title={medicine.name}>
        {shortMedicineName(medicine.name)}
      </span>
      <span className="medicine-item-series">{medicine.series}</span>
      <time className="medicine-item-date" dateTime={medicine.expiry_date}>
        {formatDate(medicine.expiry_date)}
      </time>
      {isAdmin && (
        <MedicineActions id={medicine.id} onEdit={onEdit} onDelete={onDelete} />
      )}
    </li>
  )
}

export default function MedicinesPage() {
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('expiry_date')
  const [sortDir, setSortDir] = useState('asc')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)

  const closeModal = () => setModal(null)
  const openCreate = () => setModal({ mode: 'create' })
  const openEdit = (id) => setModal({ mode: 'edit', id })

  const load = (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    rxApi.medicines
      .list()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => {
        if (showSpinner) setLoading(false)
      })
  }

  const handleFormSuccess = () => {
    closeModal()
    load(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const add = searchParams.get('add')
    const editId = searchParams.get('edit')
    if (add != null) {
      openCreate()
      setSearchParams({}, { replace: true })
    } else if (editId) {
      openEdit(Number(editId))
      setSearchParams({}, { replace: true })
    }
  }, [isAdmin, searchParams, setSearchParams])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ru')
    if (!q) return items
    return items.filter((m) => {
      const haystack = [m.name, m.series, formatDate(m.expiry_date), m.expiry_date]
        .join(' ')
        .toLocaleLowerCase('ru')
      return haystack.includes(q)
    })
  }, [items, query])

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => compareItems(a, b, sortKey, sortDir)),
    [filteredItems, sortKey, sortDir],
  )

  const handleDelete = async (id) => {
    try {
      await rxApi.medicines.delete(id)
      load(false)
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const showToolbar = isAdmin || (!loading && items.length > 0)

  return (
    <div className="medicines-page">
      {showToolbar && (
      <header className="roster-page-toolbar medicines-page__toolbar">
        {!loading && items.length > 0 && (
          <>
            <label className="sort-field">
              <span className="visually-hidden">Сортировка</span>
              <select
                className="sort-select"
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value)
                  setSortDir('asc')
                }}
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sort-dir-btn"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              aria-label={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
            <label className="medicines-page__search-field">
              <span className="visually-hidden">Поиск</span>
              <input
                type="search"
                className="medicines-page__search"
                placeholder="Поиск…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
          </>
        )}
        {isAdmin && (
          <button type="button" className="btn-primary roster-page-toolbar__action" onClick={openCreate}>
            Добавить
          </button>
        )}
      </header>
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p className="medicines-loading muted">Загрузка…</p>}

      {!loading && items.length === 0 && (
        <div className="medicines-empty">
          <p className="medicines-empty-title">Пока пусто</p>
        </div>
      )}

      {!loading && items.length > 0 && sortedItems.length === 0 && (
        <p className="medicines-empty-filter muted">Ничего не найдено.</p>
      )}

      {!loading && sortedItems.length > 0 && (
        <ul className="medicines-list" aria-label="Список лекарств">
          {sortedItems.map((m) => (
            <MedicineItem
              key={m.id}
              medicine={m}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Новое лекарство' : 'Редактирование'}
          onClose={closeModal}
        >
          <MedicineForm
            medicineId={modal.mode === 'edit' ? modal.id : undefined}
            onSuccess={handleFormSuccess}
            onCancel={closeModal}
          />
        </Modal>
      )}

    </div>
  )
}
