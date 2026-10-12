import { useState, useEffect } from 'react';

export function App() {
  const [city, setCity] = useState('SBC');
  const [progressGuarulhos, setProgressGuarulhos] = useState(0);
  const [progressSBC, setProgressSBC] = useState(0);
  const [progressRegistrationSBC, setProgressRegistrationSBC] = useState(0); // Nova barra para cadastros
  const [isLoadingGuarulhos, setIsLoadingGuarulhos] = useState(false);
  const [isLoadingSBC, setIsLoadingSBC] = useState(false);
  const [isLoadingRegistrationSBC, setIsLoadingRegistrationSBC] = useState(false); // Novo loading para cadastros
  const [error, setError] = useState(null);

  const handleCityChange = (e) => {
    setCity(e.target.value);
  };

  const fetchSheetData = async (sheetId, selectedCity) => {
    try {
      const response = await fetch(`http://localhost:3000/api/sheet/${sheetId}?city=${selectedCity}`);
      if (!response.ok) {
        throw new Error(`Falha na requisição: ${response.status} - ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dados brutos da API (primeiras 2 linhas):', JSON.stringify(data.slice(0, 2)), '...', data.length, 'linhas');
      return data;
    } catch (err) {
      console.error('Erro no fetch:', err.message);
      throw err;
    }
  };

  const fillForm = async (city, rowData) => {
    try {
      const response = await fetch('http://localhost:3000/api/fill-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, rowData }),
      });
      if (!response.ok) {
        throw new Error(`Falha ao preencher formulário: ${response.statusText}`);
      }
      const result = await response.json();
      console.log('Resultado do preenchimento:', result);
      return true;
    } catch (err) {
      console.error('Erro ao preencher formulário:', err.message);
      return false;
    }
  };

  const registerUser = async (city, rowData) => {
    try {
      const response = await fetch('http://localhost:3000/api/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, rowData }),
      });
      if (!response.ok) {
        throw new Error(`Falha ao cadastrar usuário: ${response.statusText}`);
      }
      const result = await response.json();
      console.log('Resultado do cadastro:', result);
      return result.success;
    } catch (err) {
      console.error('Erro ao cadastrar usuário:', err.message);
      return false;
    }
  };

  const handleStart = async (selectedCity) => {
    const sheetId = import.meta.env.VITE_SHEET_ID; // ID da planilha (definido no .env)
    if (!sheetId) {
      setError('ID da planilha não encontrado.');
      return;
    }

    if (selectedCity === 'Guarulhos') {
      setIsLoadingGuarulhos(true);
      setError(null);
      try {
        const rows = await fetchSheetData(sheetId, selectedCity);
        if (rows.length === 0) {
          setError('Nenhum dado encontrado na planilha.');
          setIsLoadingGuarulhos(false);
          return;
        }
        const validRows = rows.slice(1).filter(row => row.length > 0); // Ignora cabeçalho
        const totalRows = validRows.length || 1;
        console.log('Total de linhas válidas:', totalRows);
        let formsFilled = 0;

        for (const row of validRows) {
          const success = await fillForm(selectedCity, row);
          if (success) formsFilled++;
          const progress = (formsFilled / totalRows) * 100;
          setProgressGuarulhos(Math.min(progress, 100).toFixed(1));
          console.log(`Progresso Guarulhos: ${progress.toFixed(1)}%`);
        }
        setIsLoadingGuarulhos(false);
      } catch (err) {
        setError(err.message);
        setIsLoadingGuarulhos(false);
      }
    } else if (selectedCity === 'SBC') {
      setIsLoadingSBC(true);
      setError(null);
      try {
        const rows = await fetchSheetData(sheetId, selectedCity);
        if (rows.length === 0) {
          setError('Nenhum dado encontrado na planilha.');
          setIsLoadingSBC(false);
          return;
        }
        const validRows = rows.slice(1).filter(row => row.length > 0); // Ignora cabeçalho
        const totalRows = validRows.length || 1;
        console.log('Total de linhas válidas:', totalRows);
        let formsFilled = 0;

        for (const row of validRows) {
          const success = await fillForm(selectedCity, row);
          if (success) formsFilled++;
          const progress = (formsFilled / totalRows) * 100;
          setProgressSBC(Math.min(progress, 100).toFixed(1));
          console.log(`Progresso SBC: ${progress.toFixed(1)}%`);
        }
        setIsLoadingSBC(false);
      } catch (err) {
        setError(err.message);
        setIsLoadingSBC(false);
      }
    }
  };

  const handleRegistration = async () => {
    const sheetId = import.meta.env.VITE_SHEET_ID;
    if (!sheetId) {
      setError('ID da planilha não encontrado.');
      return;
    }
    setIsLoadingRegistrationSBC(true);
    setError(null);
    try {
      const rows = await fetchSheetData(sheetId, 'SBC'); // Sempre SBC para cadastros
      if (rows.length === 0) {
        setError('Nenhum dado encontrado na planilha.');
        setIsLoadingRegistrationSBC(false);
        return;
      }
      const validRows = rows.slice(1).filter(row => row.length > 0);
      const totalRows = validRows.length || 1;
      console.log('Total de linhas válidas para cadastro:', totalRows);
      let usersRegistered = 0;

      for (const row of validRows) {
        const success = await registerUser('SBC', row);
        if (success) usersRegistered++;
        const progress = (usersRegistered / totalRows) * 100;
        setProgressRegistrationSBC(Math.min(progress, 100).toFixed(1));
        console.log(`Progresso Cadastros SBC: ${progress.toFixed(1)}%`);
      }
      setIsLoadingRegistrationSBC(false);
    } catch (err) {
      setError(err.message);
      setIsLoadingRegistrationSBC(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Preenchimento Automático de Formulários</h1>
      <select
        value={city}
        onChange={handleCityChange}
        className="p-2 border rounded mb-4"
      >
        <option value="Guarulhos">Guarulhos</option>
        <option value="SBC">São Bernardo do Campo</option>
      </select>
      <button
        onClick={() => handleStart(city)}
        className="bg-blue-500 text-white p-2 rounded mb-4"
      >
        Iniciar Preenchimento
      </button>
      {city === 'SBC' && (
        <button
          onClick={handleRegistration}
          className="bg-green-500 text-white p-2 rounded mb-4 ml-4"
        >
          Iniciar Cadastros SBC
        </button>
      )}
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {isLoadingGuarulhos && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Progresso Guarulhos</h2>
          <progress value={progressGuarulhos} max="100" className="w-full" />
          <p>Progresso: {progressGuarulhos}%</p>
        </div>
      )}
      {isLoadingSBC && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Progresso SBC</h2>
          <progress value={progressSBC} max="100" className="w-full" />
          <p>Progresso: {progressSBC}%</p>
        </div>
      )}
      {isLoadingRegistrationSBC && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Progresso Cadastros SBC</h2>
          <progress value={progressRegistrationSBC} max="100" className="w-full" />
          <p>Progresso: {progressRegistrationSBC}%</p>
        </div>
      )}
    </div>
  );
}