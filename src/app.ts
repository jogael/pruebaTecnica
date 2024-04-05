import express = require("express");
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

const app = express();

app.use(express.json());

let jsonData: any[] = [];

//clave secreta de JWT
const JWT_SECRET = 'claveSecreta';


//se genera token con expiración de 1 hora
function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}


//verificamos el token
function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

//nos autenticamos con el token
function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(400).json({ message: 'Token de autenticación no proporcionado' });
  }

  const decodedToken = verifyToken(token);
  if (!decodedToken) {
    return res.status(401).json({ message: 'Token de autenticación inválido' });
  }

  (req as any).user = decodedToken;

  next();
}

//Como mochos métodos usan la lectura del archivo se creó este método que deja en 
//memoria la información del archivo y ya solo lo accedemos al inicio de la ejecución
function readDataFromFile(callback: () => void) {
  fs.readFile('MOCK_DATA.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      throw new Error('Error interno del servidor');
    }

    try {
      jsonData = JSON.parse(data);
      callback();
    } catch (parseError) {
      console.error('Error al analizar el contenido JSON:', parseError);
      throw new Error('Error interno del servidor');
    }
  });
}

function handleError(res: Response, message: string, statusCode: number = 500) {
  console.error(message);
  return res.status(statusCode).send(message);
}


//esta es una función para calcular el precio promedio
function getAveragePrice(): number {
  const totalPrice = jsonData.reduce((total, book) => total + book.price, 0);
  return parseFloat((totalPrice / jsonData.length).toFixed(2));
}

//método post para autenticarnos, solo tenemos un usuario el user4
app.post('/auth', async (req: Request, res: Response) => {
  const { user, password } = req.body;

  // Simulando la autenticación con un usuario en memoria
  const userCredentials = { username: 'user4', password: 'pass4#' };

  if (!user || !password || user !== userCredentials.username || password !== userCredentials.password) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const token = generateToken({ username: userCredentials.username });
  res.json({ token });
});

//método get del hello
app.get('/hello', authenticate, (req: Request, res: Response) => {
  res.status(200).send('¡Hello, world!');
});


//metodo get, puede recibir en el query param price, phrase o nada
app.get('/books', authenticate, (req: Request, res: Response) => {
  const { price, phrase } = req.query;

  if (price) {
    //verificamos los que son mayores al precio, solo comparo entero se puede mejorar a float
    const results = jsonData.filter((item) => item.price > parseInt(price as string, 10));
    return res.json(results);
  }

  if (phrase) {
    //esta función no me quedó muy clara pero busca la palabra en el nombre de la persona.
    const searchWords = (phrase as string).toLowerCase().split(' ');
    const results = jsonData.filter((item) => {
      const titleWords = item.author.toLowerCase().split(' ');
      return searchWords.every((word) => titleWords.includes(word));
    });
    return res.json(results);
  }

  //sin parámetros devolvemos todo.
  return res.json(jsonData);
});

app.get('/books/average', authenticate, (req: Request, res: Response) => {
  if (jsonData.length === 0) {
    return handleError(res, 'No hay libros en la lista', 404);
  }
  const averagePrice = getAveragePrice();
  res.json({ averagePrice });
});


//bussqueda por id
app.get('/books/:id', authenticate, (req: Request, res: Response) => {
  const id = req.params.id;
  const book = jsonData.find((item) => item.id === id);

  if (!book) {
    return res.status(400).send('No se encontró ningún elemento con el ID especificado');
  }
  res.json(book);
});

//es un post que debe de traer el json completo para agregar nuevos elementos
//ya están en memoria
app.post('/books', authenticate, (req: Request, res: Response) => {
  const { id, title, author, price, availability, num_reviews, stars, description } = req.body;

  if (!id || !title || !author || !price || !availability || !num_reviews || !stars || !description) {
    return res.status(400).send('Todos los campos son obligatorios');
  }

  const newBook = { id, title, author, price, availability, num_reviews, stars, description };
  jsonData.push(newBook);

  res.status(201).json(newBook);
});

const PORT = process.env.PORT || 3000;

readDataFromFile(() => {
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto 3005`);
  });
});