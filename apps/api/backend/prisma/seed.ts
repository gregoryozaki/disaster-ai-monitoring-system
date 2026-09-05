import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client.js"

import {
  isOperationalCobradeCode,
  OPERATIONAL_COBRADE_CODES
} from "../src/modules/disaster-categories/disaster-category.scope.js"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL não está definida")
}

const adapter = new PrismaPg({
  connectionString
})

const prisma = new PrismaClient({
  adapter
})

const cobradeCategories = [
  // NATURAIS - GEOLÓGICO
  {
    cobradeCode: "1.1.1.1.0",
    name: "Tremor de terra",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.1.2.0",
    name: "Tsunami",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.2.0.0",
    name: "Emanação vulcânica",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.1.1",
    name: "Quedas, tombamentos e rolamentos - Blocos",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.1.2",
    name: "Quedas, tombamentos e rolamentos - Lascas",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.1.3",
    name: "Quedas, tombamentos e rolamentos - Matacães",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.1.4",
    name: "Quedas, tombamentos e rolamentos - Lajes",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.2.1",
    name: "Deslizamentos de solo e/ou rocha",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.3.1",
    name: "Corridas de massa - Solo/Lama",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.3.2",
    name: "Corridas de massa - Rocha/Detrito",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.3.4.0",
    name: "Subsidências e colapsos",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.4.1.0",
    name: "Erosão costeira/Marinha",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.4.2.0",
    name: "Erosão de margem fluvial",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.4.3.1",
    name: "Erosão continental - Laminar",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.4.3.2",
    name: "Erosão continental - Ravinas",
    groupName: "NATURAIS - Geológico"
  },
  {
    cobradeCode: "1.1.4.3.3",
    name: "Erosão continental - Boçorocas",
    groupName: "NATURAIS - Geológico"
  },

  // NATURAIS - HIDROLÓGICO
  {
    cobradeCode: "1.2.1.0.0",
    name: "Inundações",
    groupName: "NATURAIS - Hidrológico"
  },
  {
    cobradeCode: "1.2.2.0.0",
    name: "Enxurradas",
    groupName: "NATURAIS - Hidrológico"
  },
  {
    cobradeCode: "1.2.3.0.0",
    name: "Alagamentos",
    groupName: "NATURAIS - Hidrológico"
  },

  // NATURAIS - METEOROLÓGICO
  {
    cobradeCode: "1.3.1.1.1",
    name: "Ciclones - Ventos costeiros (mobilidade de dunas)",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.1.1.2",
    name: "Ciclones - Marés de tempestade (ressaca)",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.1.2.0",
    name: "Frentes frias/Zonas de convergência",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.2.1.1",
    name: "Tempestade local/Convectiva - Tornados",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.2.1.2",
    name: "Tempestade local/Convectiva - Tempestade de raios",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.2.1.3",
    name: "Tempestade local/Convectiva - Granizo",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.2.1.4",
    name: "Tempestade local/Convectiva - Chuvas intensas",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.2.1.5",
    name: "Tempestade local/Convectiva - Vendaval",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.3.1.0",
    name: "Onda de calor",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.3.2.1",
    name: "Onda de frio - Friagem",
    groupName: "NATURAIS - Meteorológico"
  },
  {
    cobradeCode: "1.3.3.2.2",
    name: "Onda de frio - Geadas",
    groupName: "NATURAIS - Meteorológico"
  },

  // NATURAIS - CLIMATOLÓGICO
  {
    cobradeCode: "1.4.1.1.0",
    name: "Estiagem",
    groupName: "NATURAIS - Climatológico"
  },
  {
    cobradeCode: "1.4.1.2.0",
    name: "Seca",
    groupName: "NATURAIS - Climatológico"
  },
  {
    cobradeCode: "1.4.1.3.1",
    name: "Incêndio florestal - Incêndios em parques, áreas de proteção ambiental e áreas de preservação permanente",
    groupName: "NATURAIS - Climatológico"
  },
  {
    cobradeCode: "1.4.1.3.2",
    name: "Incêndio florestal - Incêndios em áreas não protegidas, com reflexos na qualidade do ar",
    groupName: "NATURAIS - Climatológico"
  },
  {
    cobradeCode: "1.4.1.4.0",
    name: "Baixa umidade do ar",
    groupName: "NATURAIS - Climatológico"
  },

  // NATURAIS - BIOLÓGICO
  {
    cobradeCode: "1.5.1.1.0",
    name: "Epidemias - Doenças infecciosas virais",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.1.2.0",
    name: "Epidemias - Doenças infecciosas bacterianas",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.1.3.0",
    name: "Epidemias - Doenças infecciosas parasíticas",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.1.4.0",
    name: "Epidemias - Doenças infecciosas fúngicas",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.2.1.0",
    name: "Infestações/Pragas - Infestações de animais",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.2.2.1",
    name: "Infestações de algas - Marés vermelhas",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.2.2.2",
    name: "Infestações de algas - Cianobactérias em reservatórios",
    groupName: "NATURAIS - Biológico"
  },
  {
    cobradeCode: "1.5.2.3.0",
    name: "Outras infestações",
    groupName: "NATURAIS - Biológico"
  },

  // TECNOLÓGICOS - SUBSTÂNCIAS RADIOATIVAS
  {
    cobradeCode: "2.1.1.1.0",
    name: "Queda de satélite (radionuclídeos)",
    groupName: "TECNOLÓGICOS - Substâncias radioativas"
  },
  {
    cobradeCode: "2.1.2.1.0",
    name: "Fontes radioativas em processos de produção",
    groupName: "TECNOLÓGICOS - Substâncias radioativas"
  },
  {
    cobradeCode: "2.1.3.1.0",
    name: "Outras fontes de liberação de radionuclídeos para o meio ambiente",
    groupName: "TECNOLÓGICOS - Substâncias radioativas"
  },

  // TECNOLÓGICOS - PRODUTOS PERIGOSOS
  {
    cobradeCode: "2.2.1.1.0",
    name: "Liberação de produtos químicos para a atmosfera causada por explosão ou incêndio",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.2.1.0",
    name: "Liberação de produtos químicos nos sistemas de água potável",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.2.2.0",
    name: "Derramamento de produtos químicos em ambiente lacustre, fluvial, marinho e aquífero",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.3.1.0",
    name: "Liberação de produtos químicos e contaminação como consequência de ações militares",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.4.1.0",
    name: "Transporte de produtos perigosos - Rodoviário",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.4.2.0",
    name: "Transporte de produtos perigosos - Ferroviário",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.4.3.0",
    name: "Transporte de produtos perigosos - Aéreo",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.4.4.0",
    name: "Transporte de produtos perigosos - Dutoviário",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.4.5.0",
    name: "Transporte de produtos perigosos - Marítimo",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },
  {
    cobradeCode: "2.2.4.6.0",
    name: "Transporte de produtos perigosos - Aquaviário",
    groupName: "TECNOLÓGICOS - Produtos perigosos"
  },

  // TECNOLÓGICOS - INCÊNDIOS URBANOS
  {
    cobradeCode: "2.3.1.1.0",
    name: "Incêndios em plantas e distritos industriais, parques e depósitos",
    groupName: "TECNOLÓGICOS - Incêndios urbanos"
  },
  {
    cobradeCode: "2.3.1.2.0",
    name: "Incêndios em aglomerados residenciais",
    groupName: "TECNOLÓGICOS - Incêndios urbanos"
  },

  // TECNOLÓGICOS - OBRAS CIVIS
  {
    cobradeCode: "2.4.1.0.0",
    name: "Colapso de edificações",
    groupName: "TECNOLÓGICOS - Obras civis"
  },
  {
    cobradeCode: "2.4.2.0.0",
    name: "Rompimento/colapso de barragens",
    groupName: "TECNOLÓGICOS - Obras civis"
  },

  // TECNOLÓGICOS - TRANSPORTE
  {
    cobradeCode: "2.5.1.0.0",
    name: "Transporte rodoviário",
    groupName: "TECNOLÓGICOS - Transporte de passageiros e cargas não perigosas"
  },
  {
    cobradeCode: "2.5.2.0.0",
    name: "Transporte ferroviário",
    groupName: "TECNOLÓGICOS - Transporte de passageiros e cargas não perigosas"
  },
  {
    cobradeCode: "2.5.3.0.0",
    name: "Transporte aéreo",
    groupName: "TECNOLÓGICOS - Transporte de passageiros e cargas não perigosas"
  },
  {
    cobradeCode: "2.5.4.0.0",
    name: "Transporte marítimo",
    groupName: "TECNOLÓGICOS - Transporte de passageiros e cargas não perigosas"
  },
  {
    cobradeCode: "2.5.5.0.0",
    name: "Transporte aquaviário",
    groupName: "TECNOLÓGICOS - Transporte de passageiros e cargas não perigosas"
  }
] as const

async function main() {
  console.log("Iniciando seed COBRADE...")

  for (const category of cobradeCategories) {
    const active = isOperationalCobradeCode(category.cobradeCode)

    await prisma.disasterCategory.upsert({
      where: {
        cobradeCode: category.cobradeCode
      },

      update: {
        name: category.name,

        groupName: category.groupName,

        active
      },

      create: {
        cobradeCode: category.cobradeCode,

        name: category.name,

        groupName: category.groupName,

        active
      }
    })
  }

  await prisma.disasterCategory.updateMany({
    where: {
      cobradeCode: {
        notIn: [...OPERATIONAL_COBRADE_CODES]
      }
    },

    data: {
      active: false
    }
  })

  await prisma.disasterCategory.updateMany({
    where: {
      cobradeCode: {
        in: [...OPERATIONAL_COBRADE_CODES]
      }
    },

    data: {
      active: true
    }
  })

  console.log(
    `Seed COBRADE concluído: ${cobradeCategories.length} categorias processadas; ` +
      `${OPERATIONAL_COBRADE_CODES.length} categorias operacionais ativas.`
  )
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed COBRADE:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
