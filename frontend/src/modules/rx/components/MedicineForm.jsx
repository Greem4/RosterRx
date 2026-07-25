import { useEffect, useState } from 'react'
import { rxApi } from '../api'

/** ISO (YYYY-MM-DD) → ДД.ММ.ГГГГ для отображения в поле. */
function isoToDisplay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!match) return ''
  const [, y, m, d] = match
  return `${d}.${m}.${y}`
}

/** ДД.ММ.ГГГГ → ISO (YYYY-MM-DD), либо '' если дата неполная/некорректная. */
function displayToIso(display) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(display)
  if (!match) return ''
  const [, d, m, y] = match
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return ''
  return `${y}-${m}-${d}`
}

/** Маска ввода даты: только цифры, точки расставляются по ходу набора. */
function maskDateInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  let out = digits.slice(0, 2)
  if (digits.length > 2) out += '.' + digits.slice(2, 4)
  if (digits.length > 4) out += '.' + digits.slice(4, 8)
  return out
}

export default function MedicineForm({ medicineId, onSuccess, onCancel }) {
  const isEdit = medicineId != null
  const [name, setName] = useState('')
  const [series, setSeries] = useState('')
  const [expiryDisplay, setExpiryDisplay] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    rxApi.medicines
      .get(medicineId)
      .then((m) => {
        setName(m.name)
        setSeries(m.series)
        setExpiryDisplay(isoToDisplay(m.expiry_date))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [medicineId, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const expiryDate = displayToIso(expiryDisplay)
    if (!expiryDate) {
      setError('Введите дату в формате ДД.ММ.ГГГГ')
      return
    }
    setError('')
    setSubmitting(true)
    const body = { name, series, expiry_date: expiryDate }
    try {
      if (isEdit) {
        await rxApi.medicines.update(medicineId, body)
      } else {
        await rxApi.medicines.create(body)
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="muted">Загрузка…</p>
  }

  return (
    <form className="medicine-form" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}
      <label>
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label>
        Серия
        <input value={series} onChange={(e) => setSeries(e.target.value)} required />
      </label>
      <label>
        Срок годности
        <input
          type="text"
          inputMode="numeric"
          placeholder="ДД.ММ.ГГГГ"
          value={expiryDisplay}
          onChange={(e) => setExpiryDisplay(maskDateInput(e.target.value))}
          maxLength={10}
          required
        />
      </label>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
