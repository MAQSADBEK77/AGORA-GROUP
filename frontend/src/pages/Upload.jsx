import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Upload as UploadIcon, User, Search, X, ImageIcon, CheckCircle } from 'lucide-react'
import api from '../api/axios'

export default function Upload() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [newPatient, setNewPatient] = useState({ full_name: '', birth_year: '', phone: '' })
  const [mode, setMode] = useState('search')

  async function searchPatients() {
    if (!search.trim()) return
    const { data } = await api.get(`/patients?search=${search}`)
    setPatients(data)
  }

  async function createPatient() {
    if (!newPatient.full_name.trim()) return toast.error('Ism kiritilishi shart')
    try {
      const { data } = await api.post('/patients', {
        full_name: newPatient.full_name,
        birth_year: newPatient.birth_year ? parseInt(newPatient.birth_year) : null,
        phone: newPatient.phone || null,
      })
      setSelectedPatient(data)
      setStep(2)
      toast.success('Bemor yaratildi')
    } catch {
      toast.error('Bemor yaratishda xato')
    }
  }

  function onFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (ext !== 'dcm') {
      return toast.error('Hozircha faqat DICOM (.dcm) fayllar qabul qilinadi')
    }
    setFile(f)
    setPreview(null)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFileChange({ target: { files: [f] } })
  }, [])

  async function handleUpload() {
    if (!file || !selectedPatient) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('patient_id', selectedPatient.id)
      formData.append('file', file)
      await api.post('/upload', formData)
      setDone(true)
      toast.success('Rasm muvaffaqiyatli yuklandi! Radiolog ko\'rib chiqadi.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Yuklash xatosi'
      toast.error(msg, { duration: 6000 })
    } finally {
      setLoading(false)
    }
  }

  // Muvaffaqiyat ekrani
  if (done) return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle size={40} className="text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Rasm yuklandi!</h2>
        <p className="text-gray-500 text-sm">
          Mammografiya rasmi navbatga qo'shildi.<br />
          Radiolog ko'rib chiqib, diagnoz qo'yadi.
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => { setDone(false); setStep(1); setFile(null); setPreview(null); setSelectedPatient(null) }}
          className="btn-secondary">Yangi rasm yuklash</button>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">Dashboard</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Mammografiya Rasm Yuklash</h2>

      <div className="flex gap-2 mb-4">
        {[1, 2].map(s => (
          <div key={s} className={`flex-1 h-2 rounded-full ${step >= s ? 'bg-blue-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="card space-y-4">
          <h3 className="font-medium text-gray-800">Qadam 1: Bemorni tanlang</h3>
          <div className="flex gap-2">
            <button onClick={() => setMode('search')}
              className={`btn-${mode === 'search' ? 'primary' : 'secondary'} text-sm`}>
              Qidirish
            </button>
            <button onClick={() => setMode('create')}
              className={`btn-${mode === 'create' ? 'primary' : 'secondary'} text-sm`}>
              Yangi bemor
            </button>
          </div>

          {mode === 'search' ? (
            <>
              <div className="flex gap-2">
                <input className="input" placeholder="Bemor ismi..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPatients()} />
                <button onClick={searchPatients} className="btn-primary flex items-center gap-1">
                  <Search size={16} /> Qidir
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {patients.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setStep(2) }}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
                    <p className="font-medium text-sm">{p.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {p.birth_year && `${p.birth_year} yil`} {p.phone}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <input className="input" placeholder="Ism familiya *" value={newPatient.full_name}
                onChange={e => setNewPatient(p => ({ ...p, full_name: e.target.value }))} />
              <input className="input" placeholder="Tug'ilgan yil" type="number"
                value={newPatient.birth_year}
                onChange={e => setNewPatient(p => ({ ...p, birth_year: e.target.value }))} />
              <input className="input" placeholder="Telefon raqami" value={newPatient.phone}
                onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))} />
              <button onClick={createPatient} className="btn-primary w-full">Bemor yaratish</button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-800">Qadam 2: Rasm yuklash</h3>
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">← Orqaga</button>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3">
            <User size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{selectedPatient?.full_name}</span>
          </div>

          <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('fileInput').click()}>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg" />
                <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null) }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5">
                  <X size={14} />
                </button>
              </div>
            ) : file ? (
              <div className="text-center">
                <ImageIcon size={40} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">{file.name}</p>
              </div>
            ) : (
              <>
                <UploadIcon size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-600">DICOM faylni tortib tashlang yoki bosing</p>
                <p className="text-xs text-gray-400 mt-1">Hozircha faqat .dcm format • Maks 50 MB</p>
              </>
            )}
            <input id="fileInput" type="file" accept=".dcm"
              className="hidden" onChange={onFileChange} />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            Rasm yuklanganidan keyin <b>radiolog</b> ko'rib chiqadi va diagnoz qo'yadi.
          </div>

          <button onClick={handleUpload} disabled={!file || loading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {loading ? (
              <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Yuklanmoqda...</>
            ) : (
              <><UploadIcon size={18} /> Yuklash</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
