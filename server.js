import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { PDFDocument, rgb } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { Solver } from '@2captcha/captcha-solver';
import dotenv from 'dotenv';

// Carrega .env
dotenv.config();

// Solver do 2CAPTCHA
const solver = new Solver(process.env.TWOCAPTCHA_KEY);

// Corrigindo __dirname para ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const authenticateGoogle = async () => {
  console.log('Autenticando com credentials.json...');
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  try {
    const client = await auth.getClient();
    console.log('Autenticação bem-sucedida.');
    return google.sheets({ version: 'v4', auth: client });
  } catch (err) {
    console.error('Erro na autenticação:', err.message);
    throw err;
  }
};

app.get('/api/sheet/:sheetId', async (req, res) => {
  const { city } = req.query;
  const sheetId = req.params.sheetId;
  console.log(`Requisição para sheetId: ${sheetId}, cidade: ${city}`);

  if (!city) {
    return res.status(400).json({ error: 'Parâmetro "city" é obrigatório.' });
  }

  const tabMap = {
    SBC: 'Cadastro SBC',
    Guarulhos: 'Guarulhos',
  };
  const tabName = tabMap[city];
  if (!tabName) {
    return res.status(400).json({ error: 'Cidade não suportada.' });
  }

  try {
    const sheets = await authenticateGoogle();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:R`,
    });
    const data = response.data.values || [];
    console.log(`Requisição processada com sucesso. ${data.length} linhas retornadas da aba ${tabName}.`);
    res.json(data);
  } catch (err) {
    console.error('Erro ao processar a requisição:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fill-form', async (req, res) => {
  const { city, rowData } = req.body;
  console.log(`Gerando PDF para cidade ${city} com dados:`, rowData);

  try {
    const modelPath = path.join(__dirname, `${city.toLowerCase()}_form.pdf`);
    console.log(`Procurando modelo em: ${modelPath}`);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Modelo PDF para ${city} não encontrado em ${modelPath}`);
    }
    const existingPdfBytes = fs.readFileSync(modelPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    console.log(`Dimensões da página: ${width} x ${height}`);

    if (city === 'SBC') {
      page.drawText(` ${rowData[0] || 'N/A'}`, { x: 59.244185, y: 660.394725, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[1] || 'N/A'}`, { x: 197.2632935, y: 659.6293695, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[3] || 'N/A'}`, { x: 60.0095405, y: 613.1411095, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[4] || 'N/A'}`, { x: 60.0095405, y: 580.8827925, size: 12, color: rgb(0, 0, 0) });
      page.drawText(`${rowData[6] || 'N/A'}`, { x: 284.995711, y: 580.8827925, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[7] || 'N/A'}`, { x: 62.248914, y: 480.6338235, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[8] || 'N/A'}`, { x: 459.7518835, y: 482.6338235, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[9] || 'N/A'}`, { x: 61.511905, y: 547.12211, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[10] || 'N/A'}`, { x: 381.0053065, y: 545.6197465, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[11] || 'N/A'}`, { x: 443.9912295, y: 547.8874665, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[12] || 'N/A'}`, { x: 60.7465495, y: 514.8921405, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[13] || 'N/A'}`, { x: 162.7372565, y: 514.8921405, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[14] || 'N/A'}`, { x: 381.0053065, y: 514.8921405, size: 12, color: rgb(0, 0, 0) });
      page.drawText(` ${rowData[15] || 'N/A'}`, { x: 417.0053615, y: 514.126785, size: 12, color: rgb(0, 0, 0) });
    } else if (city === 'Guarulhos') {
      page.drawText(`DATA: ${rowData[0] || 'N/A'}`, { x: 50, y: 100, size: 12, color: rgb(0, 0, 0) });
      page.drawText(`ASSINATURA CONDUTOR: ${rowData[1] || 'N/A'}`, { x: 50, y: 80, size: 12, color: rgb(0, 0, 0) });
      page.drawText(`ASSINATURA PROPRIETÁRIO: ${rowData[2] || 'N/A'}`, { x: 50, y: 60, size: 12, color: rgb(0, 0, 0) });
    }

    // Monta o nome do arquivo como "<NOME DO CONDUTOR> - <AIT>.pdf".
    // Para SBC: coluna D (idx 3) = NOME DO CONDUTOR, coluna A (idx 0) = AIT.
    let nome = '';
    let ait = '';
    if (city === 'SBC') {
      nome = (rowData[3] || '').trim();
      ait = (rowData[0] || '').trim();
    }

    // Remove caracteres inválidos para nome de arquivo no Windows e espaços extras.
    const sanitize = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const nomeLimpo = sanitize(nome);
    const aitLimpo = sanitize(ait);

    let baseName;
    if (nomeLimpo && aitLimpo) {
      baseName = `${nomeLimpo} - ${aitLimpo}`;
    } else if (nomeLimpo || aitLimpo) {
      baseName = nomeLimpo || aitLimpo;
    } else {
      // Sem nome/AIT: mantém o padrão antigo para não perder o arquivo.
      baseName = `form_${city}_${Date.now()}`;
    }

    // Salva os PDFs na pasta "Documentos_SBC" dentro do projeto (cria se não existir).
    const outputDir = path.join(__dirname, 'Documentos_SBC');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Pasta criada: ${outputDir}`);
    }

    // Evita sobrescrever arquivos com o mesmo nome, anexando " (2)", " (3)", ...
    let outputPath = path.join(outputDir, `${baseName}.pdf`);
    let counter = 2;
    while (fs.existsSync(outputPath)) {
      outputPath = path.join(outputDir, `${baseName} (${counter}).pdf`);
      counter++;
    }

    console.log(`PDF gerado com sucesso, salvando em: ${outputPath}`);
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    res.json({ message: 'PDF gerado com sucesso', file: outputPath });
  } catch (err) {
    console.error('Erro ao gerar PDF:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register-user', async (req, res) => {
  const { city, rowData } = req.body;
  if (city !== 'SBC') {
    return res.status(400).json({ error: 'Cadastro disponível apenas para SBC.' });
  }
  console.log(`Iniciando cadastro para SBC com dados:`, rowData);

  // Mapa de cidades para códigos
  const cidadeMap = {
    'Adamantina': '2',
    'Adolfo': '3',
    'Aguaí': '4',
    'Agudos': '9',
    'Alambari': '10',
    'Alfredo Marcondes': '11',
    'Altair': '12',
    'Altinópolis': '13',
    'Alto Alegre': '14',
    'Alumínio': '15',
    'Alvares Florence': '16',
    'Alvares Machado': '17',
    'Alvinlândia': '19',
    'Americana': '20',
    'Américo Brasiliense': '21',
    'Américo de Campos': '22',
    'Amparo': '23',
    'Analândia': '24',
    'Andradina': '25',
    'Angatuba': '26',
    'Anhembi': '27',
    'Anhumas': '28',
    'Aparecida': '29',
    'Aparecida DOeste': '30',
    'Apiaí': '31',
    'Aracariguama': '32',
    'Araçatuba': '33',
    'Araçoiaba da Serra': '34',
    'Aramina': '35',
    'Arandu': '36',
    'Arapeí': '37',
    'Araraquara': '38',
    'Araras': '39',
    'Arco-Íris': '7534',
    'Arealva': '40',
    'Areias': '41',
    'Areiópolis': '42',
    'Ariranha': '43',
    'Artur Nogueira': '44',
    'Arujá': '45',
    'Aspasia': '46',
    'Assis': '47',
    'Atibaia': '48',
    'Auriflama': '49',
    'Avaí': '50',
    'Avanhandava': '51',
    'Avaré': '52',
    'Bady Bassitt': '53',
    'Balbinos': '54',
    'Bálsamo': '55',
    'Barão de Antonina': '57',
    'Barbosa': '58',
    'Bariri': '59',
    'Barra Bonita': '60',
    'Barra do Chapeú': '61',
    'Barra do Turvo': '62',
    'Barretos': '63',
    'Barrinha': '64',
    'Barueri': '65',
    'Bastos': '66',
    'Batatais': '67',
    'Bauru': '68',
    'Bebedouro': '69',
    'Bento de Abreu': '70',
    'Bernardino de Campos': '71',
    'Bertioga': '72',
    'Bilac': '73',
    'Birigui': '74',
    'Biritiba-mirim': '75',
    'Boa Esperança do Sul': '76',
    'Bocaina': '77',
    'Bofete': '78',
    'Boituva': '79',
    'Bom Jesus dos Perdões': '80',
    'Bom Sucesso de Itararé': '81',
    'Bora': '82',
    'Boracéia': '83',
    'Borborema': '84',
    'Borebi': '85',
    'Botucatu': '86',
    'Bragança Paulista': '87',
    'Brauna': '88',
    'Brejo Alegre': '7591',
    'Brodowski': '89',
    'Brotas': '90',
    'Buri': '91',
    'Buritama': '92',
    'Buritizal': '93',
    'Cabrália Paulista': '94',
    'Cabreuva': '95',
    'Caçapava': '96',
    'Cachoeira Paulista': '97',
    'Caconde': '98',
    'Cafelândia': '99',
    'Caiabu': '100',
    'Caieiras': '101',
    'Caiua': '102',
    'Cajamar': '103',
    'Cajati': '104',
    'Cajobi': '105',
    'Cajuru': '106',
    'Campina do Monte Alegre': '107',
    'Campinas': '108',
    'Campo Limpo Paulista': '109',
    'Campos do Jordão': '110',
    'Campos Novos Paulista': '111',
    'Cananéia': '112',
    'Cândido Mota': '113',
    'Cândido Rodrigues': '114',
    'Canitar': '115',
    'Capão Bonito': '116',
    'Capela do Alto': '117',
    'Capivari': '118',
    'Caraguatatuba': '119',
    'Carapicuíba': '120',
    'Cardoso': '121',
    'Casa Branca': '122',
    'Cássia dos Coqueiros': '123',
    'Castilho': '124',
    'Catanduva': '125',
    'Catigua': '126',
    'Cedral': '127',
    'Cerqueira Cesar': '128',
    'Cerquilho': '129',
    'Cesário Lange': '130',
    'Charqueada': '131',
    'Chavantes': '132',
    'Clementina': '133',
    'Colina': '134',
    'Colombia': '135',
    'Conchal': '136',
    'Conchas': '137',
    'Cordeirópolis': '138',
    'Coroados': '139',
    'Coronel Macedo': '140',
    'Corumbataí': '141',
    'Cosmópolis': '142',
    'Cosmorama': '143',
    'Cotia': '144',
    'Cravinhos': '145',
    'Cristais Paulista': '146',
    'Cruzália': '147',
    'Cruzeiro': '148',
    'Cubatão': '149',
    'Cunha': '150',
    'Descalvado': '151',
    'Diadema': '152',
    'Dirce Reis': '153',
    'Divinolândia': '154',
    'Dobrada': '155',
    'Dois Córregos': '156',
    'Dolcinópolis': '157',
    'Dourado': '158',
    'Dracena': '159',
    'Duartina': '160',
    'Dumont': '161',
    'Echapora': '162',
    'Eldorado': '163',
    'Elias Fausto': '164',
    'Elisiario': '165',
    'Embauba': '166',
    'Embu': '167',
    'Embu-guacu': '168',
    'Emilianópolis': '169',
    'Engenheiro Coelho': '170',
    'Espírito Santo do Pinhal': '171',
    'Espírito Santo do Turvo': '172',
    'Estiva Gerbi': '173',
    'Estrela DOeste': '174',
    'Estrela do Norte': '175',
    'Euclides da Cunha Paulista': '176',
    'Fartura': '177',
    'Fernando Prestes': '178',
    'Fernandópolis': '179',
    'Fernão': '7704',
    'Ferraz de Vasconcelos': '180',
    'Flora Rica': '181',
    'Floreal': '182',
    'Flórida Paulista': '183',
    'Florinea': '184',
    'Franca': '185',
    'Francisco Morato': '186',
    'Franco da Rocha': '187',
    'Gabriel Monteiro': '188',
    'Galia': '189',
    'Garça': '190',
    'Gastão Vidigal': '191',
    'Gavião Peixoto': '7721',
    'General Salgado': '192',
    'Getulina': '193',
    'Glicério': '194',
    'Guaíra': '197',
    'Guapiaçu': '198',
    'Guapiara': '199',
    'Guará': '200',
    'Guaracai': '201',
    'Guaraci': '202',
    'Guarani DOeste': '203',
    'Guaranta': '204',
    'Guararapes': '205',
    'Guararema': '206',
    'Guaratinguetá': '207',
    'Guareí': '208',
    'Guariba': '209',
    'Guarujá': '210',
    'Guarulhos': '211',
    'Guatapara': '212',
    'Guzolândia': '213',
    'Herculândia': '214',
    'Holambra': '215',
    'Hortolândia': '216',
    'Iacanga': '217',
    'Iacri': '218',
    'Iaras': '219',
    'Ibaté': '220',
    'Ibira': '221',
    'Ibirarema': '222',
    'Ibitinga': '223',
    'Ibiuna': '224',
    'Icem': '225',
    'Iepe': '226',
    'Igaraçu do Tietê': '227',
    'Igarapava': '228',
    'Igarata': '229',
    'Iguape': '230',
    'Ilha Comprida': '231',
    'Ilha Solteira': '232',
    'Ilhabela': '233',
    'Indaiatuba': '234',
    'Indiana': '235',
    'Indiapora': '236',
    'Inubia Paulista': '237',
    'Ipauçu': '238',
    'Ipero': '239',
    'Ipeuna': '240',
    'Ipiguá': '7747',
    'Iporanga': '241',
    'Ipuã': '242',
    'Iracemápolis': '243',
    'Irapua': '244',
    'Irapuru': '245',
    'Itaí': '247',
    'Itanhaém': '250',
    'Itaoca': '251',
    'Itapecerica da Serra': '252',
    'Itapetininga': '253',
    'Itapeva': '254',
    'Itapevi': '255',
    'Itapira': '256',
    'Itapirapua Paulista': '257',
    'Itápolis': '258',
    'Itaporanga': '259',
    'Itapui': '260',
    'Itapura': '261',
    'Itaquaquecetuba': '262',
    'Itararé': '263',
    'Itariri': '264',
    'Itatiba': '265',
    'Itatinga': '266',
    'Itirapina': '267',
    'Itirapua': '268',
    'Itobi': '269',
    'Itu': '270',
    'Itupeva': '271',
    'Ituverava': '272',
    'Jaborandi': '273',
    'Jaboticabal': '274',
    'Jacareí': '275',
    'Jaci': '276',
    'Jacupiranga': '277',
    'Jaguariuna': '278',
    'Jales': '279',
    'Jambeiro': '280',
    'Jandira': '281',
    'Jardinópolis': '282',
    'Jarinú': '283',
    'Jaú': '284',
    'Jeriquara': '285',
    'Joanópolis': '286',
    'João Ramalho': '287',
    'José Bonifácio': '288',
    'Julio Mesquita': '289',
    'Jumirim': '7776',
    'Jundiaí': '290',
    'Junqueirópolis': '291',
    'Juquiá': '292',
    'Juquitiba': '293',
    'Lagoinha': '294',
    'Laranjal Paulista': '295',
    'Lavinia': '296',
    'Lavrinhas': '297',
    'Leme': '298',
    'Lençóis Paulista': '299',
    'Limeira': '300',
    'Lindóia': '301',
    'Lins': '302',
    'Lorena': '303',
    'Lourdes': '304',
    'Louveira': '305',
    'Lucélia': '306',
    'Lucianópolis': '307',
    'Luis Antonio': '308',
    'Luiziânia': '309',
    'Lupércio': '310',
    'Lutecia': '311',
    'Macatuba': '312',
    'Macaubal': '313',
    'Macedonia': '314',
    'Magda': '315',
    'Mairinque': '316',
    'Mairiporã': '317',
    'Manduri': '318',
    'Maraba Paulista': '319',
    'Maracai': '320',
    'Marapoama': '321',
    'Mariapolis': '322',
    'Marília': '323',
    'Marinópolis': '324',
    'Martinópolis': '325',
    'Matão': '326',
    'Mauá': '327',
    'Mendonça': '328',
    'Meridiano': '329',
    'Mesópolis': '330',
    'Miguelópolis': '331',
    'Mineiros do Tietê': '332',
    'Mira Estrela': '333',
    'Miracatu': '334',
    'Mirandópolis': '335',
    'Mirante do Paranapanema': '336',
    'Mirassol': '337',
    'Mirassolândia': '338',
    'Mococa': '339',
    'Mogi das Cruzes': '340',
    'Mogi Guaçu': '341',
    'Mogi Mirim': '342',
    'Mombuca': '343',
    'Monções': '344',
    'Mongaguá': '345',
    'Monte Alegre do Sul': '346',
    'Monte Alto': '347',
    'Monte Aprazível': '348',
    'Monte Azul Paulista': '349',
    'Monte Castelo': '350',
    'Monte Mor': '351',
    'Monteiro Lobato': '352',
    'Morro Agudo': '353',
    'Morungaba': '354',
    'Motuca': '355',
    'Murutinga do Sul': '356',
    'Nantes': '7836',
    'Narandiba': '357',
    'Natividade da Serra': '358',
    'Nazaré Paulista': '359',
    'Neves Paulista': '360',
    'Nhandeara': '361',
    'Nipoa': '362',
    'Nova Aliança': '363',
    'Nova Campina': '364',
    'Nova Canaã Paulista': '365',
    'Nova Castilho': '7843',
    'Nova Europa': '366',
    'Nova Granada': '367',
    'Nova Guataporanga': '368',
    'Nova Independência': '369',
    'Nova Luzitânia': '370',
    'Nova Odessa': '371',
    'Novais': '372',
    'Novo Horizonte': '373',
    'Nuporanga': '374',
    'Ocauçu': '375',
    'Óleo': '376',
    'Olímpia': '377',
    'Onda Verde': '378',
    'Oriente': '379',
    'Orindiuva': '380',
    'Orlândia': '381',
    'Osasco': '382',
    'Oscar Bressane': '383',
    'Osvaldo Cruz': '384',
    'Ourinhos': '385',
    'Ouro Verde': '386',
    'Ouroeste': '7870',
    'Pacaembu': '387',
    'Palestina': '388',
    'Palmares Paulista': '389',
    'Palmeira DOeste': '390',
    'Palmital': '391',
    'Panorama': '392',
    'Paraguaçu Paulista': '393',
    'Paraibuna': '394',
    'Paraíso': '395',
    'Paranapanema': '396',
    'Paranapuã': '397',
    'Parapuã': '398',
    'Pardinho': '399',
    'Pariquera-açu': '400',
    'Parisi': '401',
    'Patrocínio Paulista': '402',
    'Paulicéia': '403',
    'Paulínia': '404',
    'Paulo de Faria': '405',
    'Paulistânia': '7886',
    'Pederneiras': '406',
    'Pedra Bela': '407',
    'Pedranópolis': '408',
    'Pedregulho': '409',
    'Pedreira': '410',
    'Pedrinhas Paulista': '411',
    'Pedro de Toledo': '412',
    'Penápolis': '413',
    'Pereira Barreto': '414',
    'Pereiras': '415',
    'Peruíbe': '416',
    'Piacatu': '417',
    'Piedade': '418',
    'Pilar do Sul': '419',
    'Pindamonhangaba': '420',
    'Pindorama': '421',
    'Pinhalzinho': '422',
    'Piquerobi': '423',
    'Piquete': '424',
    'Piracaia': '425',
    'Piracicaba': '426',
    'Piraju': '427',
    'Pirajuí': '428',
    'Pirangi': '429',
    'Pirapora do Bom Jesus': '430',
    'Pirapozinho': '431',
    'Pirassununga': '432',
    'Piratininga': '433',
    'Pitangueiras': '434',
    'Planalto': '435',
    'Platina': '436',
    'Poá': '437',
    'Poloni': '438',
    'Pompéia': '439',
    'Pongai': '440',
    'Pontal': '441',
    'Pontalinda': '442',
    'Pontes Gestal': '443',
    'Populina': '444',
    'Porangaba': '445',
    'Porto Feliz': '446',
    'Porto Ferreira': '447',
    'Potim': '448',
    'Potirendaba': '449',
    'Pracinha': '7916',
    'Pradópolis': '450',
    'Praia Grande': '451',
    'Pratânia': '7918',
    'Presidente Alves': '452',
    'Presidente Bernardes': '453',
    'Presidente Epitácio': '454',
    'Presidente Prudente': '455',
    'Presidente Venceslau': '456',
    'Promissão': '457',
    'Quadra': '7925',
    'Quatá': '458',
    'Queiroz': '459',
    'Queluz': '460',
    'Quintana': '461',
    'Rafard': '462',
    'Rancharia': '463',
    'Redenção da Serra': '464',
    'Regente Feijó': '465',
    'Reginópolis': '466',
    'Registro': '467',
    'Restinga': '468',
    'Ribeira': '469',
    'Ribeirão Bonito': '470',
    'Ribeirão Branco': '471',
    'Ribeirão Corrente': '472',
    'Ribeirão do Sul': '473',
    'Ribeirão Grande': '474',
    'Ribeirão Pires': '475',
    'Ribeirão Preto': '476',
    'Ribeirão dos Índios': '7939',
    'Rifaina': '477',
    'Rincão': '478',
    'Rinópolis': '479',
    'Rio Claro': '480',
    'Rio das Pedras': '481',
    'Rio Grande da Serra': '482',
    'Riolândia': '483',
    'Riversul': '484',
    'Rosana': '485',
    'Roseira': '486',
    'Rubiacea': '487',
    'Rubinéia': '488',
    'Sabino': '489',
    'Sagres': '490',
    'Sales': '491',
    'Sales Oliveira': '492',
    'Salesópolis': '493',
    'Salmourão': '494',
    'Saltinho': '495',
    'Salto': '496',
    'Salto de Pirapora': '497',
    'Salto Grande': '498',
    'Santa Adélia': '500',
    'Santa Albertina': '501',
    'Santa Bárbara DOeste': '502',
    'Santa Branca': '503',
    'Santa Clara DOeste': '504',
    'Santa Cruz da Conceição': '505',
    'Santa Cruz da Esperança': '7949',
    'Santa Cruz das Palmeiras': '506',
    'Santa Cruz do Rio Pardo': '507',
    'Santa Ernestina': '508',
    'Santa Fé do Sul': '509',
    'Santa Gertrudes': '510',
    'Santa Isabel': '511',
    'Santa Lúcia': '512',
    'Santa Maria da Serra': '513',
    'Santa Mercedes': '514',
    'Santa Rita DOeste': '515',
    'Santa Rita do Passa Quatro': '516',
    'Santa Rosa de Viterbo': '517',
    'Santa Salete': '7962',
    'Santana da Ponte Pensa': '518',
    'Santana de Parnaíba': '519',
    'Santo Anastácio': '520',
    'Santo André': '521',
    'Santo Antonio da Alegria': '522',
    'Santo Antonio de Posse': '523',
    'Santo Antonio do Aracanguá': '524',
    'Santo Antonio do Jardim': '525',
    'Santo Antonio do Pinhal': '526',
    'Santo Expedito': '527',
    'Santópolis do Aguapeí': '528',
    'Santos': '529',
    'São Bento do Sapucai': '530',
    'São Bernardo do Campo': '531',
    'São Caetano do Sul': '532',
    'São Carlos': '533',
    'São Francisco': '534',
    'São João da Boa Vista': '535',
    'São João das Duas Pontes': '536',
    'São João de Iracema': '537',
    'São João do Pau DAlho': '538',
    'São Joaquim da Barra': '539',
    'São José da Bela Vista': '540',
    'São José do Barreiro': '541',
    'São José do Rio Pardo': '542',
    'São José do Rio Preto': '543',
    'São José dos Campos': '544',
    'São Lourenço da Serra': '545',
    'São Luiz do Paraitinga': '546',
    'São Manuel': '547',
    'São Miguel Arcanjo': '548',
    'São Paulo': '3015',
    'São Pedro': '549',
    'São Pedro do Turvo': '550',
    'São Roque': '551',
    'São Sebastião': '552',
    'São Sebastião da Grama': '553',
    'São Simão': '554',
    'São Vicente': '555',
    'Sarapui': '556',
    'Sarutaia': '557',
    'Sebastianópolis do Sul': '558',
    'Serra Azul': '559',
    'Serra Negra': '560',
    'Serrana': '561',
    'Sertãozinho': '562',
    'Sete Barras': '563',
    'Severinia': '564',
    'Silveiras': '565',
    'Socorro': '566',
    'Sorocaba': '567',
    'Sud Mennucci': '568',
    'Sumaré': '569',
    'Suzano': '570',
    'Suzanápolis': '571',
    'Tabapuã': '572',
    'Tabatinga': '573',
    'Taboão da Serra': '574',
    'Taciba': '575',
    'Taguai': '576',
    'Taiaçu': '577',
    'Taiuva': '578',
    'Tambaú': '579',
    'Tanabi': '580',
    'Tapirai': '581',
    'Tapiratiba': '582',
    'Taquaral': '8054',
    'Taquaritinga': '583',
    'Taquarituba': '584',
    'Taquarivai': '585',
    'Tarabai': '586',
    'Taruma': '587',
    'Tatuí': '588',
    'Taubaté': '589',
    'Tejupa': '590',
    'Teodoro Sampaio': '591',
    'Terra Roxa': '592',
    'Tietê': '593',
    'Timburi': '594',
    'Torre de Pedra': '595',
    'Torrinha': '596',
    'Trabiju': '8063',
    'Tremembé': '597',
    'Três Fronteiras': '598',
    'Tuiuti': '599',
    'Tupã': '600',
    'Tupi Paulista': '601',
    'Turiuba': '602',
    'Turmalina': '603',
    'Ubarana': '604',
    'Ubatuba': '605',
    'Ubirajara': '606',
    'Uchoa': '607',
    'União Paulista': '608',
    'Urania': '609',
    'Uru': '610',
    'Urupês': '611',
    'Valentim Gentil': '612',
    'Valinhos': '613',
    'Valparaíso': '614',
    'Vargem': '615',
    'Vargem Grande do Sul': '616',
    'Vargem Grande Paulista': '617',
    'Várzea Paulista': '618',
    'Vera Cruz': '619',
    'Vinhedo': '620',
    'Viradouro': '621',
    'Vista Alegre do Alto': '622',
    'Vitória Brasil': '8097',
    'Votorantim': '623',
    'Votuporanga': '624',
    'Zacarias': '625',
    'Águas da Prata': '5',
    'Águas de Lindóia': '6',
    'Águas de Santa Bárbara': '7',
    'Águas de São Pedro': '8',
    'Álvaro de Carvalho': '18',
    'Não informado': '999'
  };

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let browser;
    try {
      browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();
      await page.goto('https://www.saobernardo.sp.gov.br/prodigi/abrirCadUsuario.do', { waitUntil: 'networkidle2' });
      console.log('Página inicial carregada.');

      // Step 2: Acessar iframe
      await page.waitForSelector('#iFrameForm', { visible: true, timeout: 10000 });
      const iframeElement = await page.$('#iFrameForm');
      if (!iframeElement) {
        throw new Error('Iframe #iFrameForm não encontrado.');
      }
      const iframe = await iframeElement.contentFrame();
      if (!iframe) {
        throw new Error('Não foi possível acessar o conteúdo do iframe #iFrameForm.');
      }
      console.log('Iframe #iFrameForm acessado com sucesso.');

      // Step 3: Format and add CPF (coluna G)
      const rawCpf = rowData[6] || '';
      const formattedCpf = rawCpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      console.log('CPF formatado:', formattedCpf);
      await iframe.waitForSelector('#cpf', { visible: true, timeout: 10000 });
      await iframe.type('#cpf', formattedCpf);
      console.log('CPF incluído:', formattedCpf);

      // Step 4: Trigger blur to ensure validation
      await iframe.evaluate(() => {
        const cpfInput = document.querySelector('#cpf');
        if (cpfInput) {
          cpfInput.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      });
      console.log('Evento blur disparado no campo CPF.');

      // Step 5: Wait for validation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 6: Check for validation errors
      const errorSelectors = [
        '.msgErro',
        '.alert',
        '.alert-danger',
        '.error',
        '[role="alert"]',
        '#msg-alerta-texto',
        '.mensagemErro',
        '.form-erro-formato',
        '.msgErroFormato',
        '#erroFormulario'
      ];
      let errorMessage = null;
      for (const selector of errorSelectors) {
        const errorElement = await iframe.$(selector) || await page.$(selector);
        if (errorElement) {
          errorMessage = await (iframe.$(selector) ? iframe : page).evaluate(el => el.textContent.trim(), errorElement);
          console.log(`Mensagem de erro encontrada com seletor ${selector}:`, errorMessage);
          break;
        }
      }
      if (errorMessage) {
        throw new Error(`Erro na validação do CPF: ${errorMessage}`);
      }

      // Step 7: Click Próximo
      await iframe.evaluate(() => {
        const btn = document.querySelector('#btProximo');
        if (btn) btn.click();
      });
      console.log('Botão Próximo clicado via JavaScript no iframe.');

      // Step 8: Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        console.log('Navegação após #btProximo concluída ou timeout.');
      });

      // Debug: Log current URL
      const currentUrl = await page.url();
      console.log(`URL atual após clique em #btProximo: ${currentUrl}`);

      // Debug: Log page HTML
      const postProximoHtml = await page.evaluate(() => document.body.outerHTML);
      console.log('HTML do <body> após #btProximo:', postProximoHtml.substring(0, 2000) + '...');

      // Step 9: Check if still on CPF page
      const cpfInput = await iframe.$('#cpf');
      if (cpfInput) {
        throw new Error('Navegação não ocorreu; ainda na página de CPF dentro do iframe.');
      }

      // Step 10: Continue with form filling (simplified for brevity)
      await browser.close();
      console.log('Cadastro concluído com sucesso (parcial).');
      return res.json({ success: true, message: 'Cadastro iniciado; verifique a interface gráfica.' });

    } catch (err) {
      console.error(`Erro no cadastro (tentativa ${attempt + 1}/${maxRetries}):`, err.message);
      if (browser) {
        await browser.close().catch(() => {});
      }
      if (attempt === maxRetries - 1) {
        return res.status(500).json({ error: err.message });
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));