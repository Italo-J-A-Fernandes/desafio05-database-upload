import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransactions {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const contactsReadStrem = fs.createReadStream(filePath);

    const parsers = csvParse({
      from_line: 2,
    });

    const parseCSV = contactsReadStrem.pipe(parsers);

    const transactions: CSVTransactions[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoriesExists = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const categoriesExistTitle = categoriesExists.map(
      (category: Category) => category.title,
    );

    const categoriesAddTitles = categories
      .filter(category => !categoriesExistTitle.includes(category))
      .filter((value, idx, self) => self.indexOf(value) === idx);

    const newCategories = categoriesRepository.create(
      categoriesAddTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);
  }
}

export default ImportTransactionsService;
